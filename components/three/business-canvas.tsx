"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── spring (gripper) ────────────────────────────────────────────────── */
function springSmooth(cur: number, tgt: number, vel: { v: number }, stiffness: number, damping: number, dt: number) {
  const force = (tgt - cur) * stiffness;
  vel.v = (vel.v + force * dt) * Math.pow(damping, dt * 60);
  return cur + vel.v * dt;
}

/* ─── module-level navigate (set by BusinessCanvas via useRouter) ─────── */
let navigateTo: ((href: string) => void) | null = null;

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

/* ─── coin texture — heavy "pound sterling" style, AI in place of the bust ─ */
function makeCoinTex(label: string) {
  const s = 512, c = document.createElement("canvas");
  c.width = s; c.height = s;
  const g = c.getContext("2d")!;
  const h = s / 2;

  // brushed silver/steel field with a warm rim
  const grad = g.createRadialGradient(h, h - 40, 20, h, h, h);
  grad.addColorStop(0, "#F2F2F0");
  grad.addColorStop(0.45, "#C7C9CC");
  grad.addColorStop(0.8, "#8A8D92");
  grad.addColorStop(1, "#55585E");
  g.beginPath(); g.arc(h, h, h - 2, 0, Math.PI * 2); g.fillStyle = grad; g.fill();

  // double engraved ring
  g.beginPath(); g.arc(h, h, h - 16, 0, Math.PI * 2);
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.arc(h, h, h - 26, 0, Math.PI * 2);
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.arc(h, h, h - 46, 0, Math.PI * 2);
  g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 2; g.stroke();

  // milled (reeded) edge ticks
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    g.beginPath();
    g.moveTo(h + Math.cos(a) * (h - 14), h + Math.sin(a) * (h - 14));
    g.lineTo(h + Math.cos(a) * (h - 8), h + Math.sin(a) * (h - 8));
    g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 1.5; g.stroke();
  }

  // central "AI" relief (the portrait)
  g.save();
  g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 6; g.shadowOffsetY = 2;
  g.fillStyle = "#3a3c40"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `700 200px "Cormorant Garamond", Georgia, serif`;
  g.fillText("AI", h, h - 18);
  g.restore();

  // service name arched along the bottom
  g.fillStyle = "#42454a";
  g.font = `600 ${label.length > 9 ? 30 : 38}px Inter, system-ui, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  const radius = h - 62;
  const text = label.toUpperCase();
  const totalAngle = Math.min(Math.PI * 0.9, text.length * 0.16);
  const start = Math.PI / 2 + totalAngle / 2;
  for (let i = 0; i < text.length; i++) {
    const a = start - (i / Math.max(1, text.length - 1)) * totalAngle;
    g.save();
    g.translate(h + Math.cos(a) * radius, h + Math.sin(a) * radius);
    g.rotate(a - Math.PI / 2);
    g.fillText(text[i], 0, 0);
    g.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ─── coins — 6 services, each navigates to its page on grab ──────────── */
interface CD {
  x: number; y: number; z: number;
  rs: number; fs: number; fa: number; ph: number; sc: number;
  label: string; route: string; tilt: number;
}

const COINS: CD[] = [
  { x: -3.4, y: 1.9,  z: 0.3,  rs: 0.30, fs: 0.40, fa: 0.20, ph: 0.0, sc: 0.95, label: "AI Bots",   route: "/ai-bots",       tilt: 0.3 },
  { x: -1.5, y: 2.6,  z: -0.4, rs: 0.26, fs: 0.35, fa: 0.24, ph: 1.2, sc: 0.85, label: "VPN",       route: "/vpn",           tilt: 0.4 },
  { x: -4.1, y: 0.0,  z: -0.8, rs: 0.34, fs: 0.30, fa: 0.18, ph: 2.4, sc: 0.78, label: "Instagram", route: "/instagram",     tilt: 0.4 },
  { x: -2.3, y: -1.1, z: 0.1,  rs: 0.28, fs: 0.42, fa: 0.26, ph: 0.8, sc: 0.88, label: "Memory",    route: "/vector-memory", tilt: 0.35 },
  { x: -0.5, y: 1.2,  z: -0.6, rs: 0.36, fs: 0.38, fa: 0.16, ph: 3.1, sc: 0.80, label: "3D Sites",  route: "/web3d",         tilt: 0.3 },
  { x: -3.0, y: -2.1, z: -0.3, rs: 0.24, fs: 0.40, fa: 0.22, ph: 1.8, sc: 0.82, label: "Avatar",    route: "/avatar",        tilt: 0.45 },
];

function Coin({ d, idx }: { d: CD; idx: number }) {
  const ref = useRef<THREE.Group>(null!);
  const tex = useMemo(() => makeCoinTex(d.label), [d.label]);
  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, metalness: 0.9, roughness: 0.22, emissive: new THREE.Color("#C9A961"), emissiveIntensity: 0 }),
    [tex],
  );
  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ metalness: 0.95, roughness: 0.16, color: "#cfd1d4" });
    return [side, faceMat, faceMat];
  }, [faceMat]);

  const local = useRef({ scale: d.sc, rx: d.tilt, ry: 0 });

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const selected = armShared.grabbedIdx === idx;
    const l = local.current;
    const calm = prefersReducedMotion ? 0.4 : 1;

    if (selected && armShared.phase === "reach") {
      coinWorldPositions[idx].copy(ref.current.position);
      return;
    }

    if (selected) {
      const rev = armShared.reveal;
      const tip = armShared.tipWorld;
      const targetZ = THREE.MathUtils.lerp(d.z, REVEAL_Z, rev);
      const wx = THREE.MathUtils.lerp(ref.current.position.x, tip.x, 0.25);
      const wy = THREE.MathUtils.lerp(ref.current.position.y, tip.y + 0.3, 0.25);
      const wz = THREE.MathUtils.lerp(ref.current.position.z, targetZ, 0.18);
      ref.current.position.set(wx, wy, wz);
      coinWorldPositions[idx].set(wx, wy, wz);

      l.ry = THREE.MathUtils.lerp(l.ry, 0, 0.12);
      l.rx = THREE.MathUtils.lerp(l.rx, 0, 0.12);
      const tgtScale = THREE.MathUtils.lerp(d.sc, d.sc * 2.4, rev);
      l.scale = THREE.MathUtils.lerp(l.scale, tgtScale, 0.12);
      ref.current.rotation.set(l.rx, l.ry, 0);
      ref.current.scale.setScalar(l.scale);
      faceMat.emissiveIntensity = rev * 0.4;
      return;
    }

    const depth = 1 - Math.abs(d.z) / 4;
    const px = 0.15 + depth * 0.35;
    const wx = d.x + mouseNDC.x * px;
    const wy = d.y + Math.sin(t * d.fs + d.ph) * d.fa * calm + mouseNDC.y * px * 0.4;
    ref.current.position.set(wx, wy, d.z);
    coinWorldPositions[idx].set(wx, wy, d.z);
    l.scale = THREE.MathUtils.lerp(l.scale, d.sc, 0.1);
    ref.current.scale.setScalar(l.scale);
    if (faceMat.emissiveIntensity > 0.001) faceMat.emissiveIntensity *= 0.9;
    l.ry = t * d.rs * calm;
    l.rx = d.tilt + Math.sin(t * 0.2 + d.ph) * 0.12 * calm;
    ref.current.rotation.set(l.rx, l.ry, 0);
  });

  return (
    <group ref={ref} scale={d.sc}>
      <mesh material={mats} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
      </mesh>
    </group>
  );
}

/* ─── Shared coin world positions (mutated by Coin, read by Arm) ────── */
const coinWorldPositions: THREE.Vector3[] = COINS.map(() => new THREE.Vector3());

/* ─── Robotic Arm — Spline GLB rig, blued steel, servo follow + grab ────
 *
 * Spline export gives a clean named chain:
 *   Base Y Rotation → 1 Hand X rotation → 2 Hand X Rotation → 3 Hand X Rotate → Grab(1,2)
 * We drive those real joints (no primitive IK), apply blued steel, prune the
 * UI text / floor / lights / 268 decorative sphere-clones. The arm greedily
 * tracks the cursor (servo steps), and clicking a coin makes it grab, swing the
 * coin up toward the viewer, then navigate to that service page.
 */
const ARM_GLB = "/models/robot-arm.glb";
useGLTF.preload(ARM_GLB);

/* Fast-tune posing — adjust after screenshot, no logic changes needed. */
const ARM_FIT_HEIGHT = 3.4;
const ARM_POS = new THREE.Vector3(3.4, -1.9, 0.2);
const ARM_EULER: [number, number, number] = [0, 0, 0];

/* Joint travel (radians) relative to the model's imported rest pose */
const BASE_YAW_RANGE = 0.85;
const J1_RANGE = 0.6;
const J2_RANGE = 0.7;
const J3_RANGE = 0.5;

/* Present pose offsets (relative to rest) — raise the held coin toward camera */
const PRESENT = { j1: 0.55, j2: -0.7, j3: 0.35 };

/* Насколько пальцы гриппера (1/2) смыкаются на хвате (радианы, навстречу).
 * Ось X — лучший расчёт по ригу; если пальцы пойдут не туда — флип знака здесь. */
const GRIP_CLOSE = 0.32;

const armClick = { fired: false };

const armShared = {
  phase: "seek" as "seek" | "reach" | "grab" | "present" | "reveal" | "return",
  grabbedIdx: -1,
  tipWorld: new THREE.Vector3(),
  reveal: 0,
  navigated: false,
};

const REVEAL_Z = 3.6;

const servoStep = (cur: number, tgt: number, frac: number) => cur + (tgt - cur) * frac;

function RoboticArm() {
  const root = useRef<THREE.Group>(null!);
  const gltf = useGLTF(ARM_GLB);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const { camera } = useThree();

  const rig = useRef<{
    baseY?: THREE.Object3D;
    j1?: THREE.Object3D;
    j2?: THREE.Object3D;
    j3?: THREE.Object3D;
    grab?: THREE.Object3D;
    f1?: THREE.Object3D;
    f2?: THREE.Object3D;
    rest: Map<THREE.Object3D, { x: number; y: number; z: number }>;
    ready: boolean;
  }>({ rest: new Map(), ready: false });

  const fitted = useRef(false);
  const grabTimer = useRef(0);
  const grip = useRef(0); // 0 раскрыт, 1 сомкнут

  useEffect(() => {
    // Lighter blued steel so the metal reads without an env-map (Pavel: brighter).
    const blued = new THREE.MeshStandardMaterial({ color: "#5b5f6a", metalness: 0.7, roughness: 0.48 });
    const dark = new THREE.MeshStandardMaterial({ color: "#34373f", metalness: 0.8, roughness: 0.5 });
    const accent = new THREE.MeshStandardMaterial({ color: "#C9A961", metalness: 0.92, roughness: 0.16 });

    ["UI", "Floor", "Camera", "Target", "Sphere Clones",
      "Directional Light", "Directional Light 2", "Default Ambient Light"]
      .forEach((n) => { const o = scene.getObjectByName(n); o?.parent?.remove(o); });

    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const nm = (o.name || "").toLowerCase();
      if (nm === "1" || nm === "2") m.material = dark;
      else if (nm.includes("ellipse")) m.material = accent;
      else m.material = blued;
      m.castShadow = m.receiveShadow = false;
    });

    const r = rig.current;
    r.baseY = scene.getObjectByName("Base Y Rotation") ?? undefined;
    r.j1 = scene.getObjectByName("1 Hand X rotation") ?? undefined;
    r.j2 = scene.getObjectByName("2 Hand X Rotation") ?? undefined;
    r.j3 = scene.getObjectByName("3 Hand X Rotate") ?? undefined;
    r.grab = scene.getObjectByName("Grab") ?? undefined;
    r.f1 = scene.getObjectByName("1") ?? undefined; // палец гриппера (лезвие −Y)
    r.f2 = scene.getObjectByName("2") ?? undefined; // палец гриппера (лезвие +Y)
    [r.baseY, r.j1, r.j2, r.j3, r.f1, r.f2].forEach((o) => {
      if (o) r.rest.set(o, { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z });
    });
    r.ready = true;
    fitted.current = false;
  }, [scene]);

  useFrame((state, delta) => {
    const r = rig.current;
    const g = root.current;
    if (!g || !r.ready) return;

    if (!fitted.current) {
      g.scale.setScalar(1);
      g.rotation.set(0, 0, 0);
      g.position.set(0, 0, 0);
      g.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const s = ARM_FIT_HEIGHT / maxDim;
      g.scale.setScalar(s);
      g.rotation.set(ARM_EULER[0], ARM_EULER[1], ARM_EULER[2]);
      g.position.set(
        ARM_POS.x - center.x * s,
        ARM_POS.y - (center.y - size.y / 2) * s,
        ARM_POS.z - center.z * s,
      );
      fitted.current = true;
    }

    // publish gripper-tip world position so the grabbed coin can stick to it
    if (r.grab) r.grab.getWorldPosition(armShared.tipWorld);

    // Рука — герой страницы, замирать НЕ должна. При prefers-reduced-motion
    // глушим амплитуду idle-качки (calm), но движение и реакция на курсор
    // остаются — иначе на машинах с выключенной анимацией рука стоит мёртвой
    // (это и был баг: «стоит статично, не реагирует на мышку»).
    const calm = prefersReducedMotion ? 0.4 : 1;
    const dt = Math.min(delta, 0.05);
    const step = Math.min(0.5, (1 - Math.pow(0.0001, dt)) * 1.7);

    const clicked = armClick.fired;
    armClick.fired = false;

    // ─── state machine ───
    const phase = armShared.phase;
    if (phase === "seek") {
      if (clicked) {
        // nearest coin to cursor in screen space
        let best = -1, bestD = 0.22;
        const v = new THREE.Vector3();
        for (let i = 0; i < coinWorldPositions.length; i++) {
          v.copy(coinWorldPositions[i]).project(camera);
          const dd = Math.hypot(v.x - mouseNDC.x, v.y - mouseNDC.y);
          if (dd < bestD) { bestD = dd; best = i; }
        }
        if (best >= 0) {
          armShared.grabbedIdx = best;
          armShared.phase = "grab";
          armShared.reveal = 0;
          armShared.navigated = false;
          grabTimer.current = 0;
        }
      }
    } else if (phase === "grab") {
      grabTimer.current += dt;
      if (grabTimer.current > 0.35) armShared.phase = "present";
    } else if (phase === "present") {
      armShared.reveal = THREE.MathUtils.lerp(armShared.reveal, 1, 0.06);
      if (armShared.reveal > 0.9 && !armShared.navigated) {
        armShared.navigated = true;
        const coin = COINS[armShared.grabbedIdx];
        if (coin && navigateTo) {
          // brief beat so the viewer sees the coin face, then navigate
          setTimeout(() => navigateTo && navigateTo(coin.route), 450);
        }
      }
    }

    // ─── drive joints ───
    const reach = (mouseNDC.y + 1) / 2;
    const setRel = (o: THREE.Object3D | undefined, axis: "x" | "y" | "z", target: number) => {
      if (!o) return;
      const rest = r.rest.get(o);
      if (!rest) return;
      o.rotation[axis] = servoStep(o.rotation[axis], rest[axis] + target, step);
    };

    const presenting = phase === "grab" || phase === "present";
    if (presenting) {
      // swing to a fixed present pose; base yaws toward the grabbed coin
      const coinW = coinWorldPositions[armShared.grabbedIdx];
      const yaw = coinW ? THREE.MathUtils.clamp((coinW.x - ARM_POS.x) * 0.12, -BASE_YAW_RANGE, BASE_YAW_RANGE) : 0;
      setRel(r.baseY, "y", yaw);
      setRel(r.j1, "x", PRESENT.j1);
      setRel(r.j2, "x", PRESENT.j2);
      setRel(r.j3, "x", PRESENT.j3);
    } else {
      // Всегда живой: непрерывная серво-качка (sin по времени) + реакция на курсор
      // сверху. Так рука двигается даже когда мышь неподвижна.
      const t = state.clock.elapsedTime;
      const idleY = Math.sin(t * 0.45) * 0.5 * calm;
      const idleJ1 = Math.sin(t * 0.4 + 0.6) * 0.22 * calm;
      const idleJ2 = Math.sin(t * 0.5 + 1.2) * 0.26 * calm;
      const idleJ3 = Math.sin(t * 0.65 + 0.3) * 0.18 * calm;
      setRel(r.baseY, "y", idleY + mouseNDC.x * BASE_YAW_RANGE * 0.5);
      setRel(r.j1, "x", idleJ1 + (reach - 0.4) * J1_RANGE * 0.5);
      setRel(r.j2, "x", idleJ2 + (0.5 - reach) * J2_RANGE * 0.5);
      setRel(r.j3, "x", idleJ3 + (reach - 0.5) * J3_RANGE * 0.5);
    }

    // ─── гриппер: пальцы смыкаются на хвате, раскрываются в seek ───
    const wantClosed = phase === "grab" || phase === "present";
    grip.current = THREE.MathUtils.lerp(grip.current, wantClosed ? 1 : 0, 0.18);
    const gc = grip.current * GRIP_CLOSE;
    if (r.f1) { const rf = r.rest.get(r.f1); if (rf) r.f1.rotation.x = rf.x + gc; }
    if (r.f2) { const rf = r.rest.get(r.f2); if (rf) r.f2.rotation.x = rf.x - gc; }
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  );
}

/* ─── background depth ───────────────────────────────────────────────── */
function DepthBackground() {
  const groupRef = useRef<THREE.Group>(null!);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#2a2015", transparent: true, opacity: 0.25, side: THREE.DoubleSide }), []);
  const ringGold = useMemo(() => new THREE.MeshBasicMaterial({ color: "#C9A961", transparent: true, opacity: 0.08, side: THREE.DoubleSide }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#C9A961", transparent: true, opacity: 0.05 }), []);
  const glowWarm = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8B6914", transparent: true, opacity: 0.07 }), []);

  useFrame(({ clock }) => {
    if (!groupRef.current || prefersReducedMotion) return;
    groupRef.current.rotation.y = mouseNDC.x * 0.04 + clock.elapsedTime * 0.005;
    groupRef.current.rotation.x = mouseNDC.y * 0.02;
  });

  return (
    <group ref={groupRef}>
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
      {[
        { pos: [-5, 3, -12] as const, s: 4, warm: true },
        { pos: [6, -2, -16] as const, s: 5, warm: false },
        { pos: [-3, -4, -10] as const, s: 3, warm: false },
        { pos: [4, 5, -18] as const, s: 6, warm: true },
        { pos: [0, 0, -20] as const, s: 8, warm: false },
        { pos: [-7, -1, -14] as const, s: 4.5, warm: true },
        { pos: [2, -3, -8] as const, s: 2.5, warm: false },
        { pos: [-1, 6, -15] as const, s: 5, warm: true },
      ].map((gg, i) => (
        <mesh key={`g${i}`} material={gg.warm ? glowWarm : glowMat} position={[...gg.pos]} scale={gg.s}>
          <sphereGeometry args={[1, 16, 16]} />
        </mesh>
      ))}
      <mesh position={[0, -4.5, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 30, 40, 30]} />
        <meshBasicMaterial color="#1a1510" transparent opacity={0.08} wireframe />
      </mesh>
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

/* ─── BearBrick — matching first-page chrome ────────────────────────── */
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
      {/* Lifted exposure — Pavel: business scene was too dark, brighten it. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[-5, 6, 4]} intensity={2.0} color="#fff5dc" />
      <directionalLight position={[5, -3, 5]} intensity={1.0} color="#C9A961" />
      <directionalLight position={[3, 4, 6]} intensity={1.6} color="#ffffff" />
      <pointLight position={[-4, 3, 3]} intensity={1.2} color="#C9A961" distance={18} decay={2} />
      <pointLight position={[4, -1, 5]} intensity={0.7} color="#8B6914" distance={15} decay={2} />
      <pointLight position={[0, 0, -5]} intensity={0.4} color="#C9A961" distance={25} decay={2} />
      <pointLight position={[2, 3, 3]} intensity={0.6} color="#ffffff" distance={14} decay={2} />
      <pointLight position={[-1, 0, 4]} intensity={0.9} color="#C9A961" distance={8} decay={2} />
      <pointLight position={[3, -1, 3]} intensity={1.5} color="#ffffff" distance={14} decay={2} />
      <pointLight position={[3, 2, 4]} intensity={1.2} color="#dfe6ff" distance={14} decay={2} />

      <fog attach="fog" args={["#0d0d12", 8, 30]} />

      <DepthBackground />
      <Particles />

      {COINS.map((c, i) => <Coin key={i} d={c} idx={i} />)}

      <Suspense fallback={null}>
        <BearBrickModel />
      </Suspense>

      <Suspense fallback={null}>
        <RoboticArm />
      </Suspense>
    </>
  );
}

/* ─── canvas export ──────────────────────────────────────────────────── */
export function BusinessCanvas() {
  const router = useRouter();
  useEffect(() => {
    navigateTo = (href: string) => router.push(href);
    return () => { navigateTo = null; };
  }, [router]);

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
        style={{ background: "#0d0d12" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
