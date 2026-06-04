"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Center, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/bearbrick.glb.glb";

// Pre-render "ASK / ME" onto a canvas, wrap as a CanvasTexture once.
function makeAskMeTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  // Subtle dark glow background just behind text for readability on chrome reflections
  ctx.fillStyle = "#C9A961";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 8;
  ctx.font = "900 78px Inter, system-ui, sans-serif";
  ctx.fillText("ASK", size / 2, size / 2 - 40);
  ctx.fillText("ME",  size / 2, size / 2 + 44);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
// Created once, reused across renders
const askMeTexture = typeof document !== "undefined" ? makeAskMeTexture() : null;

// Materials — created once
const chromeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#E8E8E8"),
  metalness: 0.95,
  roughness: 0.15,
});
const darkMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#0a0a0a"),
  metalness: 0.2,
  roughness: 0.3,
});

interface ModelProps {
  autoRotate: boolean;
  targetX: React.MutableRefObject<number>;
  targetY: React.MutableRefObject<number>;
  scrollVel: React.MutableRefObject<number>; // signed scroll velocity (px/frame, smoothed)
  bounce: React.MutableRefObject<number>;    // 0..1 — current hop progress
}

// Damped spring state for mouse-follow (replaces lerp for livelier feel)
interface SpringState { vx: number; vy: number }
const SPRING_STIFFNESS = 6;
const SPRING_DAMPING = 0.88;

function BearModel({ autoRotate, targetX, targetY, scrollVel, bounce }: ModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(MODEL_PATH);
  const baseY = useRef(0); // resting Y position
  const tiltRef = useRef(0); // current forward-lean angle
  const spring = useRef<SpringState>({ vx: 0, vy: 0 });

  // Override materials on first load
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const name = (child.name ?? "").toLowerCase();
      const isDark =
        name.includes("body") ||
        name.includes("torso") ||
        name.includes("chest") ||
        name.includes("upper");
      child.material = (isDark ? darkMat : chromeMat).clone();
      child.castShadow = false; // no shadows — keep bear as floating object
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;

    // --- Hop animation driven by scrollVel ---
    // bounce.current decays naturally; scroll spikes recharge it
    bounce.current = Math.max(0, bounce.current - delta * 2.2);

    // Vertical hop: parabolic arc — height proportional to bounce
    const hopHeight = Math.sin(Math.min(bounce.current, 1) * Math.PI) * 0.65;
    g.position.y = baseY.current + hopHeight;

    // Forward lean ("running posture") — proportional to scroll velocity
    const targetTilt = THREE.MathUtils.clamp(scrollVel.current * 0.012, -0.45, 0.45);
    tiltRef.current = THREE.MathUtils.lerp(tiltRef.current, targetTilt, 0.18);
    g.rotation.x = tiltRef.current;

    // Side-to-side wobble while bouncing (legs running)
    const wobble = Math.sin(bounce.current * Math.PI * 4) * 0.15 * Math.min(bounce.current, 1);
    g.rotation.z = wobble;

    // Y rotation — auto-spin when idle, look-at when hovered, fast spin when scrolling
    if (Math.abs(scrollVel.current) > 0.3) {
      // Subtle yaw shake during scroll
      g.rotation.y += delta * (2 * Math.PI / 12);
    } else if (autoRotate) {
      g.rotation.y += delta * (2 * Math.PI / 20);
    } else {
      // Damped spring for mouse-follow (overshoot + settle instead of monotonic lerp)
      const s = spring.current;
      s.vy += (targetY.current - g.rotation.y) * SPRING_STIFFNESS * delta;
      s.vx += (targetX.current - g.rotation.x) * SPRING_STIFFNESS * delta;
      s.vy *= Math.pow(SPRING_DAMPING, delta * 60);
      s.vx *= Math.pow(SPRING_DAMPING, delta * 60);
      g.rotation.y += s.vy * delta * 60;
      g.rotation.x += s.vx * delta * 60;
    }
  });

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={scene} scale={[1.15, 0.92, 1.18]} dispose={null} />

        {/* ASK/ME — flat plane glued to bear's belly. Single-sided so it hides
            naturally when the bear turns around. Rotates+moves with the model. */}
        {askMeTexture && (
          <mesh position={[0, -0.35, 0.55]} renderOrder={999}>
            <planeGeometry args={[0.55, 0.55]} />
            <meshBasicMaterial
              map={askMeTexture}
              transparent
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
    </Center>
  );
}

// ── Main exported component ──────────────────────────────────────────────────
export function BearBrick() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const scrollVel = useRef(0);
  const bounce = useRef(0);
  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);

  // Subscribe to scroll — drive bounce + velocity refs
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;
      // Smooth velocity (exponential)
      scrollVel.current = scrollVel.current * 0.65 + dy * 0.35;
      // Each scroll-tick gives the bear a hop kick
      bounce.current = Math.min(1.2, bounce.current + Math.abs(dy) * 0.018);
    };
    const decay = () => {
      // Damp velocity each frame (so it returns to 0 when scrolling stops)
      scrollVel.current *= 0.92;
      if (Math.abs(scrollVel.current) < 0.05) scrollVel.current = 0;
      raf = requestAnimationFrame(decay);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(decay);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const ny = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    targetY.current = nx * 0.5;
    targetX.current = -ny * 0.3;
  };

  const handleMouseLeave = () => {
    setHovered(false);
    targetX.current = 0;
    targetY.current = 0;
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      className="relative w-[130px] h-[160px] md:w-[200px] md:h-[230px] cursor-pointer"
      style={{
        transform: hovered ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        background: "transparent",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.5, 5.5], fov: 38 }}
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.2} />
        <directionalLight position={[-2, 3, 2]} intensity={1.2} color="#fff5dc" />
        <directionalLight position={[2, -1, 1]} intensity={0.6} color="#C9A961" />

        <Suspense fallback={null}>
          <Environment preset="studio" />
        </Suspense>

        <Suspense fallback={null}>
          <BearModel
            autoRotate={!hovered}
            targetX={targetX}
            targetY={targetY}
            scrollVel={scrollVel}
            bounce={bounce}
          />
        </Suspense>
      </Canvas>

    </div>
  );
}

useGLTF.preload(MODEL_PATH);
