"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── spring (kept for gripper) ───────────────────────────────────────── */
function springSmooth(cur: number, tgt: number, vel: { v: number }, stiffness: number, damping: number, dt: number) {
  const force = (tgt - cur) * stiffness;
  vel.v = (vel.v + force * dt) * Math.pow(damping, dt * 60);
  return cur + vel.v * dt;
}

/* ─── step-lerp: discrete servo steps ~25Hz with overshoot ───────────── */
const SERVO_HZ = 25;
const SERVO_INTERVAL = 1 / SERVO_HZ;

function stepLerp(
  cur: number,
  tgt: number,
  acc: { timer: number; prev: number; overshoot: number },
  dt: number,
): number {
  acc.timer += dt;
  if (acc.timer < SERVO_INTERVAL) return cur;
  acc.timer -= SERVO_INTERVAL;

  // Guard: a non-finite target would poison cur permanently (NaN rotation →
  // NaN matrix → WebGL context loss). Hold the last good value instead.
  if (!Number.isFinite(tgt)) return cur;

  const delta = tgt - cur;
  const absDelta = Math.abs(delta);

  // Variable step: fast slew on large deltas, slower near target
  const stepFrac = absDelta > 0.3 ? 0.35 : absDelta > 0.1 ? 0.22 : 0.12;
  let next = cur + delta * stepFrac;

  // Overshoot 2-5% when arriving near target
  if (absDelta < 0.05 && Math.abs(acc.prev) > 0.05) {
    acc.overshoot = delta * (0.02 + Math.random() * 0.03) * -1; // slight past-target
  }
  if (Math.abs(acc.overshoot) > 0.001) {
    next += acc.overshoot;
    acc.overshoot *= 0.6; // decay overshoot
  }
  acc.prev = delta;
  return next;
}

/* ─── shared mouse ───────────────────────────────────────────────────── */
const mouseNDC = { x: 0, y: 0 };

function MouseTracker() {
  const { size, gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const h = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    canvas.addEventListener("pointermove", h, { passive: true });
    window.addEventListener("pointermove", h, { passive: true });
    return () => {
      canvas.removeEventListener("pointermove", h);
      window.removeEventListener("pointermove", h);
    };
  }, [gl, size]);
  return null;
}

/* invisible plane that captures R3F pointer events as fallback */
function JsonPointerCatcher() {
  return (
    <mesh
      position={[0, 0, 5]}
      onPointerMove={(e) => {
        if (e.uv) {
          mouseNDC.x = e.uv.x * 2 - 1;
          mouseNDC.y = e.uv.y * 2 - 1;
        }
      }}
    >
      <planeGeometry args={[50, 50]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/* ─── coin texture ───────────────────────────────────────────────────── */
const COIN_LABELS = ["AI", "BOT", "CRM", "API", "$", "24/7", "ROI", "AUTO"];

function makeCoinTex(label: string) {
  const s = 512, c = document.createElement("canvas");
  c.width = s; c.height = s;
  const g = c.getContext("2d")!;
  const h = s / 2;

  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0, "#E8C860");
  grad.addColorStop(0.6, "#C9A030");
  grad.addColorStop(0.9, "#8B6914");
  grad.addColorStop(1, "#5A4008");
  g.beginPath(); g.arc(h, h, h - 2, 0, Math.PI * 2); g.fillStyle = grad; g.fill();

  g.beginPath(); g.arc(h, h, h - 18, 0, Math.PI * 2);
  g.strokeStyle = "rgba(255,255,255,0.2)"; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.arc(h, h, h - 35, 0, Math.PI * 2);
  g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2; g.stroke();

  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    g.beginPath();
    g.moveTo(h + Math.cos(a) * (h - 20), h + Math.sin(a) * (h - 20));
    g.lineTo(h + Math.cos(a) * (h - 16), h + Math.sin(a) * (h - 16));
    g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 1; g.stroke();
  }

  g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 8;
  g.fillStyle = "#F5E6C0"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `900 ${label.length > 3 ? 75 : 105}px Inter, system-ui, sans-serif`;
  g.fillText(label, h, h + 4);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ─── coins — fixed positions, no overlap ────────────────────────────── */
interface CD { x: number; y: number; z: number; rs: number; fs: number; fa: number; ph: number; sc: number; label: string; tilt: number }

const COINS: CD[] = [
  { x: -3.2, y: 1.8,  z: 0.5, rs: 0.35, fs: 0.4,  fa: 0.2,  ph: 0,    sc: 0.8, label: "AI",   tilt: 0.3 },
  { x: -2.0, y: -0.5, z: -0.5,rs: 0.28, fs: 0.35, fa: 0.25, ph: 1.2,  sc: 0.7, label: "BOT",  tilt: 0.45 },
  { x: -4.0, y: 0.5,  z: -1,  rs: 0.4,  fs: 0.3,  fa: 0.18, ph: 2.4,  sc: 0.6, label: "CRM",  tilt: 0.4 },
  { x: -1.0, y: 2.5,  z: 0,   rs: 0.32, fs: 0.42, fa: 0.3,  ph: 0.8,  sc: 0.7, label: "API",  tilt: 0.35 },
  { x: 0.5,  y: 1.2,  z: -1,  rs: 0.42, fs: 0.38, fa: 0.15, ph: 3.1,  sc: 0.6, label: "$",    tilt: 0.25 },
  { x: -1.5, y: -2.0, z: 0,   rs: 0.25, fs: 0.4,  fa: 0.22, ph: 1.8,  sc: 0.65,label: "24/7", tilt: 0.5 },
  { x: -3.8, y: -1.5, z: -2,  rs: 0.3,  fs: 0.28, fa: 0.15, ph: 4.0,  sc: 0.5, label: "ROI",  tilt: 0.55 },
  { x: 1.5,  y: -0.8, z: -1.5,rs: 0.36, fs: 0.33, fa: 0.2,  ph: 2.0,  sc: 0.55,label: "AUTO", tilt: 0.4 },
  { x: -4.5, y: 2.5,  z: -2.5,rs: 0.2,  fs: 0.25, fa: 0.12, ph: 5.0,  sc: 0.45,label: "AI",   tilt: 0.6 },
  { x: -2.5, y: 3.0,  z: -1.5,rs: 0.22, fs: 0.28, fa: 0.1,  ph: 3.5,  sc: 0.5, label: "$",    tilt: 0.5 },
];

function Coin({ d, idx }: { d: CD; idx: number }) {
  const ref = useRef<THREE.Group>(null!);
  const tex = useMemo(() => makeCoinTex(d.label), [d.label]);
  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, metalness: 0.85, roughness: 0.15, emissive: new THREE.Color("#C9A961"), emissiveIntensity: 0 }),
    [tex],
  );
  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ metalness: 0.95, roughness: 0.08, color: "#C9A961" });
    return [side, faceMat, faceMat];
  }, [faceMat]);

  // Smoothed local state for the grabbed→present→reveal ride.
  const local = useRef({ scale: d.sc, rx: d.tilt, ry: 0 });

  useFrame(({ clock }) => {
    if (!ref.current || prefersReducedMotion) return;
    const t = clock.elapsedTime;
    const selected = armShared.grabbedIdx === idx;
    const l = local.current;

    // During "reach" the coin FREEZES in place (a stationary target) so the arm
    // can converge on it; it sticks to the gripper only once actually grabbed.
    if (selected && armShared.phase === "reach") {
      coinWorldPositions[idx].copy(ref.current.position);
      return;
    }

    if (selected) {
      // Stick to the gripper tip; during reveal, ride forward toward the camera.
      const rev = armShared.reveal; // 0..1
      const tip = armShared.tipWorld;
      const targetZ = THREE.MathUtils.lerp(d.z, REVEAL_Z, rev);
      const wx = THREE.MathUtils.lerp(ref.current.position.x, tip.x, 0.25);
      const wy = THREE.MathUtils.lerp(ref.current.position.y, tip.y + 0.35, 0.25);
      const wz = THREE.MathUtils.lerp(ref.current.position.z, targetZ, 0.18);
      ref.current.position.set(wx, wy, wz);
      coinWorldPositions[idx].set(wx, wy, wz);

      // Turn its face flat to the camera and grow as it presents.
      l.ry = THREE.MathUtils.lerp(l.ry, 0, 0.12);
      l.rx = THREE.MathUtils.lerp(l.rx, 0, 0.12);
      const tgtScale = THREE.MathUtils.lerp(d.sc, d.sc * 2.4, rev);
      l.scale = THREE.MathUtils.lerp(l.scale, tgtScale, 0.12);
      ref.current.rotation.set(l.rx, l.ry, 0);
      ref.current.scale.setScalar(l.scale);
      faceMat.emissiveIntensity = rev * 0.5; // glow on reveal
      return;
    }

    // Free-floating default.
    const depth = 1 - Math.abs(d.z) / 4;
    const px = 0.15 + depth * 0.35;
    const wx = d.x + mouseNDC.x * px;
    const wy = d.y + Math.sin(t * d.fs + d.ph) * d.fa + mouseNDC.y * px * 0.4;
    ref.current.position.set(wx, wy, d.z);
    coinWorldPositions[idx].set(wx, wy, d.z);
    // Ease scale/emissive back to rest if just released.
    l.scale = THREE.MathUtils.lerp(l.scale, d.sc, 0.1);
    ref.current.scale.setScalar(l.scale);
    if (faceMat.emissiveIntensity > 0.001) faceMat.emissiveIntensity *= 0.9;
    l.ry = t * d.rs;
    l.rx = d.tilt + Math.sin(t * 0.2 + d.ph) * 0.12;
    ref.current.rotation.set(l.rx, l.ry, 0);
  });

  return (
    <group ref={ref} scale={d.sc}>
      <mesh material={mats} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.07, 40]} />
      </mesh>
    </group>
  );
}

/* ─── Shared coin world positions (mutated by Coin, read by Arm) ────── */
const coinWorldPositions: THREE.Vector3[] = COINS.map(() => new THREE.Vector3());

/* ─── Robotic Arm — blued-steel industrial, step-lerp, click-to-grab ── */
const L1 = 2.2;
const L2 = 1.8;
const ARM_ORIGIN = new THREE.Vector3(1.8, -2.0, 1);

/** Global click flag — set by canvas pointerdown, consumed by arm */
const armClick = { fired: false };

/** Gate for the click→grab→present→reveal pickup mechanic (WIP — tune with Pavel). */
const GRAB_ENABLED = false;

/**
 * Shared arm↔coin state. The arm writes its gripper-tip world position and the
 * currently grabbed coin index here every frame; the grabbed Coin reads them to
 * stick to the gripper, then ride forward into the camera during the reveal.
 */
const armShared = {
  phase: "seek" as "seek" | "reach" | "grab" | "present" | "reveal" | "return",
  grabbedIdx: -1,
  tipWorld: new THREE.Vector3(),
  /** 0→1 reveal progress: how far the held coin has come toward the viewer */
  reveal: 0,
};

/** Present pose as FIXED servo angles (not an IK target) — guarantees a clean,
 *  repeatable "hold it up toward the viewer" pose instead of a down-folded IK branch. */
const PRESENT_A1 = 0.05;  // shoulder ≈ straight up
const PRESENT_A2 = -0.7;  // elbow slight forward bend
/** How far toward the camera the revealed coin travels (z grows toward cam at z≈7). */
const REVEAL_Z = 3.6;

function RoboticArm() {
  const base = useRef<THREE.Group>(null!);
  const seg1 = useRef<THREE.Group>(null!);
  const seg2 = useRef<THREE.Group>(null!);
  const gripL = useRef<THREE.Mesh>(null!);
  const gripR = useRef<THREE.Mesh>(null!);

  const state = useRef({
    a1: 0, a2: -1.5,
    sv1: { timer: 0, prev: 0, overshoot: 0 },
    sv2: { timer: 0, prev: 0, overshoot: 0 },
    gripW: 0.18, gv: { v: 0 },
    grabTimer: 0, reachTimer: 0,
  });

  const { camera } = useThree();

  const getTipWorld = (a1r: number, a2r: number) => {
    const a1 = a1r + Math.PI / 2;
    const ex = Math.cos(a1) * L1;
    const ey = Math.sin(a1) * L1;
    const tx = ex + Math.cos(a1 + a2r) * (L2 + 0.4);
    const ty = ey + Math.sin(a1 + a2r) * (L2 + 0.4);
    return new THREE.Vector3(ARM_ORIGIN.x + tx, ARM_ORIGIN.y + ty, ARM_ORIGIN.z);
  };

  useFrame((_, delta) => {
    if (!seg1.current || prefersReducedMotion) return;
    const dt = Math.min(delta, 0.05);
    if (dt === 0) return;
    const s = state.current;

    // Mouse world target — intersect the camera→mouse ray with the arm's z-plane.
    const mouseWorld = new THREE.Vector3(mouseNDC.x, mouseNDC.y, 0.5).unproject(camera);
    const dir = mouseWorld.sub(camera.position).normalize();
    // Guard against a ray parallel to the z-plane: dir.z ≈ 0 → t = ±Infinity →
    // NaN target → NaN IK angles → NaN matrix → WebGL context loss.
    let mouseX = ARM_ORIGIN.x;
    let mouseY = ARM_ORIGIN.y + 1;
    if (Math.abs(dir.z) > 1e-4) {
      const t = (ARM_ORIGIN.z - camera.position.z) / dir.z;
      const worldTarget = camera.position.clone().add(dir.multiplyScalar(t));
      if (Number.isFinite(worldTarget.x) && Number.isFinite(worldTarget.y)) {
        mouseX = worldTarget.x;
        mouseY = worldTarget.y;
      }
    }

    // Publish gripper-tip world position so the grabbed coin can stick to it.
    const tip = getTipWorld(s.a1, s.a2);
    armShared.tipWorld.copy(tip);

    const clicked = armClick.fired;
    armClick.fired = false;

    // ─── State machine: seek → reach → grab → present → reveal → return ───
    // GRAB_ENABLED gates the click→grab→present→reveal pickup sequence. The full
    // mechanic is implemented below but the present-pose tuning needs a hands-on
    // pass with Pavel (arm currently folds down instead of presenting up), so it's
    // dormant for now — the arm cleanly follows the cursor. Flip to true to resume.
    const phase = armShared.phase;
    if (phase === "seek") {
      // Click ON a coin (nearest coin to the cursor in screen space) → reach for it.
      if (clicked && GRAB_ENABLED) {
        let best = -1, bestD = 0.2; // NDC click radius
        const v = new THREE.Vector3();
        for (let i = 0; i < coinWorldPositions.length; i++) {
          v.copy(coinWorldPositions[i]).project(camera);
          const dd = Math.hypot(v.x - mouseNDC.x, v.y - mouseNDC.y);
          if (dd < bestD) { bestD = dd; best = i; }
        }
        if (best >= 0) { armShared.grabbedIdx = best; armShared.phase = "reach"; s.reachTimer = 0; }
      }
    } else if (phase === "reach") {
      // Travel to the now-frozen coin; clamp shut when close, or after a short
      // fallback so a coin at the edge of reach still gets grabbed.
      s.reachTimer += dt;
      const c = coinWorldPositions[armShared.grabbedIdx];
      if ((c && tip.distanceTo(c) < 0.7) || s.reachTimer > 1.6) { armShared.phase = "grab"; s.grabTimer = 0; }
    } else if (phase === "grab") {
      s.grabTimer += dt; // let the gripper visibly close before lifting
      if (s.grabTimer > 0.3) armShared.phase = "present";
    } else if (phase === "present") {
      // Mechanically swing up to the fixed present pose, then start the reveal.
      if (Math.abs(s.a1 - PRESENT_A1) < 0.12 && Math.abs(s.a2 - PRESENT_A2) < 0.15) {
        armShared.phase = "reveal";
      }
    } else if (phase === "reveal") {
      armShared.reveal = THREE.MathUtils.lerp(armShared.reveal, 1, 0.05);
      if (clicked) armShared.phase = "return"; // (future: navigate to a case page)
    } else if (phase === "return") {
      armShared.reveal = THREE.MathUtils.lerp(armShared.reveal, 0, 0.1);
      if (armShared.reveal < 0.05) { armShared.grabbedIdx = -1; armShared.phase = "seek"; }
    }

    // grab / present / reveal hold a FIXED present pose (angles, not IK).
    const presenting = phase === "grab" || phase === "present" || phase === "reveal";
    const isHolding = presenting || phase === "return";

    // ─── Target angles depend on phase ───
    let tgt1: number, tgt2: number;
    if (presenting) {
      tgt1 = PRESENT_A1; tgt2 = PRESENT_A2;
    } else {
      // seek → mouse; reach → frozen coin; return → coin's home — all via IK.
      let targetX = mouseX, targetY = mouseY;
      if (phase === "reach") {
        const c = coinWorldPositions[armShared.grabbedIdx];
        if (c) { targetX = c.x; targetY = c.y; }
      } else if (phase === "return") {
        const home = COINS[armShared.grabbedIdx];
        if (home) { targetX = home.x; targetY = home.y; }
      }
      const tx2 = targetX - ARM_ORIGIN.x;
      const ty2 = targetY - ARM_ORIGIN.y;
      const rawD = Math.sqrt(tx2 * tx2 + ty2 * ty2);
      const maxR = L1 + L2 - 0.1;
      const d = THREE.MathUtils.clamp(rawD, 0.5, maxR);
      const cosA = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
      const baseAngle = Math.atan2(ty2, tx2);
      tgt1 = baseAngle - Math.acos(cosA) - Math.PI / 2;
      const cosB = THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
      tgt2 = -(Math.PI - Math.acos(cosB));
    }

    // Step-lerp for mechanical servo feel
    s.a1 = stepLerp(s.a1, tgt1, s.sv1, dt);
    s.a2 = stepLerp(s.a2, tgt2, s.sv2, dt);

    // Final safety net: never feed a non-finite rotation to the GPU.
    if (!Number.isFinite(s.a1)) s.a1 = 0;
    if (!Number.isFinite(s.a2)) s.a2 = -1.5;

    seg1.current.rotation.z = s.a1;
    if (seg2.current) seg2.current.rotation.z = s.a2;

    // Gripper open/close (spring is fine here — pneumatic feel)
    const gTgt = isHolding ? 0.06 : 0.18;
    s.gripW = springSmooth(s.gripW, gTgt, s.gv, 14, 0.76, dt);
    if (gripL.current) gripL.current.position.x = s.gripW;
    if (gripR.current) gripR.current.position.x = -s.gripW;
  });

  /* ── Industrial blued-steel materials ─────────────────────────────── */
  const bluedSteel = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#3a3d45", metalness: 0.85, roughness: 0.45,
  }), []);
  const jointRing = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#2d3040", metalness: 0.88, roughness: 0.3,
  }), []);
  const darkMetal = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#2a2c34", metalness: 0.9, roughness: 0.5,
  }), []);
  const accent = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#C9A961", metalness: 0.92, roughness: 0.1,
  }), []);
  const warn = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#D4442A", metalness: 0.6, roughness: 0.3,
  }), []);
  const gripMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#33363e", metalness: 0.87, roughness: 0.42,
  }), []);

  return (
    <group ref={base} position={[1.8, -2.0, 1]}>
      {/* === BASE — heavy industrial pedestal === */}
      <mesh material={darkMetal} position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.7, 1.1, 1.0, 32]} />
      </mesh>
      <mesh material={bluedSteel} position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.58, 0.7, 0.12, 32]} />
      </mesh>
      <mesh material={accent} position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.44, 0.52, 0.06, 28]} />
      </mesh>
      {/* Warning stripes ring */}
      <mesh material={warn} position={[0, -0.92, 0]}>
        <cylinderGeometry args={[1.1, 1.12, 0.06, 32]} />
      </mesh>

      {/* === SEGMENT 1 — upper arm === */}
      <group ref={seg1}>
        {/* Shoulder — heavy joint housing */}
        <mesh material={bluedSteel}>
          <sphereGeometry args={[0.38, 24, 24]} />
        </mesh>
        <mesh material={jointRing} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38, 0.055, 12, 32]} />
        </mesh>
        {/* Bolt details on shoulder */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <mesh key={`sb${i}`} material={darkMetal}
            position={[Math.cos(i * Math.PI / 3) * 0.32, Math.sin(i * Math.PI / 3) * 0.32, 0.12]}>
            <cylinderGeometry args={[0.03, 0.03, 0.06, 6]} />
          </mesh>
        ))}

        {/* Upper arm — thick main cylinder */}
        <mesh material={bluedSteel} position={[0, L1 / 2, 0]}>
          <cylinderGeometry args={[0.2, 0.25, L1, 20]} />
        </mesh>
        {/* Panel overlays */}
        <mesh material={jointRing} position={[0.22, L1 / 2, 0]}>
          <boxGeometry args={[0.04, L1 * 0.7, 0.15]} />
        </mesh>
        <mesh material={jointRing} position={[-0.22, L1 / 2, 0]}>
          <boxGeometry args={[0.04, L1 * 0.7, 0.15]} />
        </mesh>
        {/* Hydraulic pistons */}
        <mesh material={gripMat} position={[0.3, L1 * 0.35, 0]}>
          <cylinderGeometry args={[0.04, 0.04, L1 * 0.55, 8]} />
        </mesh>
        <mesh material={gripMat} position={[-0.3, L1 * 0.35, 0]}>
          <cylinderGeometry args={[0.04, 0.04, L1 * 0.55, 8]} />
        </mesh>
        {/* Piston mounts */}
        <mesh material={bluedSteel} position={[0.3, L1 * 0.08, 0]}>
          <boxGeometry args={[0.08, 0.06, 0.08]} />
        </mesh>
        <mesh material={bluedSteel} position={[-0.3, L1 * 0.08, 0]}>
          <boxGeometry args={[0.08, 0.06, 0.08]} />
        </mesh>
        <mesh material={jointRing} position={[0.3, L1 * 0.6, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
        </mesh>
        <mesh material={jointRing} position={[-0.3, L1 * 0.6, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
        </mesh>
        {/* Cable conduit */}
        <mesh material={darkMetal} position={[0, L1 * 0.5, 0.18]}>
          <cylinderGeometry args={[0.025, 0.025, L1 * 0.8, 8]} />
        </mesh>

        {/* === ELBOW JOINT — heavy === */}
        <group position={[0, L1, 0]}>
          <mesh material={bluedSteel}>
            <sphereGeometry args={[0.3, 24, 24]} />
          </mesh>
          <mesh material={jointRing} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.045, 12, 32]} />
          </mesh>
          <mesh material={darkMetal} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.35, 12]} />
          </mesh>
        </group>

        {/* === SEGMENT 2 — forearm === */}
        <group ref={seg2} position={[0, L1, 0]}>
          <mesh material={bluedSteel} position={[0, L2 / 2, 0]}>
            <cylinderGeometry args={[0.14, 0.19, L2, 16]} />
          </mesh>
          {/* Side panels */}
          <mesh material={jointRing} position={[0.16, L2 / 2, 0]}>
            <boxGeometry args={[0.03, L2 * 0.6, 0.12]} />
          </mesh>
          {/* Hydraulic */}
          <mesh material={gripMat} position={[0.2, L2 * 0.35, 0]}>
            <cylinderGeometry args={[0.032, 0.032, L2 * 0.45, 8]} />
          </mesh>
          {/* Cable */}
          <mesh material={darkMetal} position={[-0.12, L2 * 0.5, 0.1]}>
            <cylinderGeometry args={[0.02, 0.02, L2 * 0.7, 8]} />
          </mesh>

          {/* Wrist */}
          <mesh material={bluedSteel} position={[0, L2, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
          </mesh>
          <mesh material={jointRing} position={[0, L2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.035, 10, 24]} />
          </mesh>

          {/* === GRIPPER — industrial === */}
          <group position={[0, L2 + 0.15, 0]}>
            <mesh material={bluedSteel}>
              <cylinderGeometry args={[0.15, 0.18, 0.14, 16]} />
            </mesh>
            {/* Left finger */}
            <mesh ref={gripL} material={gripMat} position={[0.14, 0.3, 0]}>
              <boxGeometry args={[0.07, 0.52, 0.12]} />
            </mesh>
            {/* Right finger */}
            <mesh ref={gripR} material={gripMat} position={[-0.14, 0.3, 0]}>
              <boxGeometry args={[0.07, 0.52, 0.12]} />
            </mesh>
            {/* Finger tips — red warning */}
            <mesh material={warn} position={[0.11, 0.56, 0]}>
              <boxGeometry args={[0.08, 0.1, 0.13]} />
            </mesh>
            <mesh material={warn} position={[-0.11, 0.56, 0]}>
              <boxGeometry args={[0.08, 0.1, 0.13]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ─── background depth ───────────────────────────────────────────────── */
function DepthBackground() {
  const groupRef = useRef<THREE.Group>(null!);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#2a2015", transparent: true, opacity: 0.25, side: THREE.DoubleSide }), []);
  const ringGold = useMemo(() => new THREE.MeshBasicMaterial({ color: "#C9A961", transparent: true, opacity: 0.08, side: THREE.DoubleSide }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#C9A961", transparent: true, opacity: 0.04 }), []);
  const glowWarm = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8B6914", transparent: true, opacity: 0.06 }), []);

  useFrame(({ clock }) => {
    if (!groupRef.current || prefersReducedMotion) return;
    groupRef.current.rotation.y = mouseNDC.x * 0.04 + clock.elapsedTime * 0.005;
    groupRef.current.rotation.x = mouseNDC.y * 0.02;
  });

  return (
    <group ref={groupRef}>
      {/* Torus rings at various depths */}
      {[
        { r: 7, z: -14, ry: 0.3, rx: 0.8, gold: false },
        { r: 5, z: -10, ry: -0.5, rx: 0.2, gold: true },
        { r: 9, z: -18, ry: 0.8, rx: -0.3, gold: false },
        { r: 3.5, z: -8, ry: -0.2, rx: 1.2, gold: false },
        { r: 6, z: -16, ry: 1.2, rx: 0.5, gold: true },
        { r: 4, z: -6, ry: 0.7, rx: -0.5, gold: false },
        { r: 8, z: -12, ry: -0.8, rx: 0.9, gold: true },
      ].map((ring, i) => (
        <mesh key={i} material={ring.gold ? ringGold : ringMat} position={[0, 0, ring.z]} rotation={[ring.rx, ring.ry, 0]}>
          <torusGeometry args={[ring.r, 0.05, 8, 80]} />
        </mesh>
      ))}
      {/* Glow orbs — warm ambient */}
      {[
        { pos: [-5, 3, -12] as const, s: 4, warm: true },
        { pos: [6, -2, -16] as const, s: 5, warm: false },
        { pos: [-3, -4, -10] as const, s: 3, warm: false },
        { pos: [4, 5, -18] as const, s: 6, warm: true },
        { pos: [0, 0, -20] as const, s: 8, warm: false },
        { pos: [-7, -1, -14] as const, s: 4.5, warm: true },
        { pos: [2, -3, -8] as const, s: 2.5, warm: false },
        { pos: [-1, 6, -15] as const, s: 5, warm: true },
      ].map((g, i) => (
        <mesh key={`g${i}`} material={g.warm ? glowWarm : glowMat} position={[...g.pos]} scale={g.s}>
          <sphereGeometry args={[1, 16, 16]} />
        </mesh>
      ))}
      {/* Grid floor for depth perspective */}
      <mesh position={[0, -4.5, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 30, 40, 30]} />
        <meshBasicMaterial color="#1a1510" transparent opacity={0.08} wireframe />
      </mesh>
      {/* Vertical accent lines */}
      {[-6, -3, 3, 6].map((x, i) => (
        <mesh key={`vl${i}`} position={[x, 0, -15]}>
          <planeGeometry args={[0.01, 18]} />
          <meshBasicMaterial color="#C9A961" transparent opacity={0.03} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── particles ──────────────────────────────────────────────────────── */
function Particles() {
  const count = 350;
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 22;
      a[i * 3 + 1] = (Math.random() - 0.5) * 14;
      a[i * 3 + 2] = -2 + Math.random() * -18;
    }
    return a;
  }, []);
  const ref = useRef<THREE.Points>(null!);
  useFrame(({ clock }) => {
    if (!ref.current || prefersReducedMotion) return;
    ref.current.rotation.y = clock.elapsedTime * 0.006;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#C9A961" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

/* ─── BearBrick — matching first page style ─────────────────────────── */
function BearBrickModel() {
  const gltf = useGLTF("/models/bearbrick.glb.glb");
  const ref = useRef<THREE.Group>(null!);
  const fitted = useRef(false);

  const chromeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#E8E8E8", metalness: 0.95, roughness: 0.15,
  }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#0a0a0a", metalness: 0.2, roughness: 0.3,
  }), []);

  useEffect(() => {
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const name = (child.name ?? "").toLowerCase();
      const isDark = name.includes("body") || name.includes("torso") || name.includes("chest") || name.includes("upper");
      (child as THREE.Mesh).material = isDark ? darkMat : chromeMat;
    });
  }, [gltf.scene, chromeMat, darkMat]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (!fitted.current) {
      const box = new THREE.Box3().setFromObject(ref.current);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const targetH = 0.9;
        const s = targetH / maxDim;
        ref.current.scale.setScalar(s);
        ref.current.position.set(2.8, -1.5 - center.y * s, 2.5);
        fitted.current = true;
      }
    }
    if (prefersReducedMotion) return;
    ref.current.rotation.y += 0.003;
  });

  return (
    <group ref={ref} position={[2.8, -1.5, 2.5]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

/* ─── scene ───────────────────────────────────────────────────────────── */
function Scene() {
  return (
    <>
      <MouseTracker />
      <JsonPointerCatcher />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-5, 6, 4]} intensity={1.4} color="#fff5dc" />
      <directionalLight position={[5, -3, 5]} intensity={0.7} color="#C9A961" />
      <pointLight position={[-4, 3, 3]} intensity={1.0} color="#C9A961" distance={18} decay={2} />
      <pointLight position={[4, -1, 5]} intensity={0.5} color="#8B6914" distance={15} decay={2} />
      <pointLight position={[0, 0, -5]} intensity={0.3} color="#C9A961" distance={25} decay={2} />
      <pointLight position={[2, 3, 3]} intensity={0.4} color="#ffffff" distance={14} decay={2} />
      <pointLight position={[-1, 0, 4]} intensity={0.8} color="#C9A961" distance={8} decay={2} />

      <fog attach="fog" args={["#07070a", 6, 28]} />

      {/* No <Environment>: the children-baking path (offscreen cubemap render)
          left the canvas black. Metals are lit by the lights above instead,
          mirroring the home-page globe which renders with no Environment. */}

      <DepthBackground />
      <Particles />

      {COINS.map((c, i) => <Coin key={i} d={c} idx={i} />)}

      <Suspense fallback={null}>
        <BearBrickModel />
      </Suspense>

      <RoboticArm />
    </>
  );
}

/* ─── canvas export ──────────────────────────────────────────────────── */
export function BusinessCanvas() {
  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 1 }}
      onPointerMove={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      }}
      onPointerDown={(e) => {
        // Sync the cursor position on the click itself — a tap may not emit a
        // preceding pointermove, so the coin pick must use the click's own NDC.
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        armClick.fired = true;
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.5]}
        frameloop="always"
        style={{ background: "#07070a" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
