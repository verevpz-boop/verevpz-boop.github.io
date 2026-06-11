"use client";
import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Earth } from "./earth";
import { Satellite } from "./satellite";
import { DeepStarField } from "./deep-star-field";

// ── Satellite configuration ──────────────────────────────────────────────────
const SATELLITES = [
  {
    name: "GAMING",
    color: "#4488FF",
    orbitRadius: 9,
    orbitRotation: [0, 0, 0] as [number, number, number],
    speed: (2 * Math.PI) / 15,
    initialAngle: 0,
    href: "/gaming",
    description: "3D-персонажи, sci-fi и fantasy миры",
    videoSrc: "/videos/satellites/gaming.webm",
  },
  {
    name: "TECH",
    color: "#E0E0E0",
    orbitRadius: 11.25,
    orbitRotation: [25, 0, 0] as [number, number, number],
    speed: (2 * Math.PI) / 18,
    initialAngle: 1.2,
    href: "/tech",
    description: "Реклама технологичных продуктов",
    videoSrc: "/videos/satellites/tech.webm",
  },
  {
    name: "CINEMA",
    color: "#8B2222",
    orbitRadius: 13.5,
    orbitRotation: [0, 0, 40] as [number, number, number],
    speed: (2 * Math.PI) / 16,
    initialAngle: 2.5,
    href: "/cinema",
    description: "AI-кино и актёрские сцены",
  },
  {
    name: "FASHION",
    color: "#C9A961",
    orbitRadius: 15.75,
    orbitRotation: [45, 0, 60] as [number, number, number],
    speed: (2 * Math.PI) / 20,
    initialAngle: 0.7,
    href: "/fashion",
    description: "AI-визуалы для моды и красоты",
    videoSrc: "/videos/satellites/fashion.webm",
  },
  {
    name: "AI-BOTS",
    color: "#FF8C1E",
    orbitRadius: 18,
    orbitRotation: [80, 0, 0] as [number, number, number],
    speed: (2 * Math.PI) / 17,
    initialAngle: 4.0,
    href: "/ai-bots",
    description: "n8n-боты и AI-помощники",
    modelInside: "/models/brain.glb",
  },
];

// ── Camera fly-to controller ──────────────────────────────────────────────────
interface FlyTarget {
  position: THREE.Vector3;
  href: string;
}

function CameraController({
  target,
  onArrived,
}: {
  target: FlyTarget | null;
  onArrived: (href: string) => void;
}) {
  const elapsed = useRef(0);

  useFrame((state, delta) => {
    if (!target) {
      elapsed.current = 0;
      return;
    }
    elapsed.current += delta;
    state.camera.position.lerp(target.position, 0.06);
    state.camera.lookAt(0, 0, 0);
    if (elapsed.current >= 1.3) {
      onArrived(target.href);
    }
  });

  return null;
}

// ── Main exported component ───────────────────────────────────────────────────
export function GlobeCanvas() {
  const router = useRouter();
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  const navigate = useCallback(
    (href: string) => router.push(href),
    [router],
  );

  const handleSatelliteClick = useCallback(
    (pos: THREE.Vector3, href: string) => {
      const flyPos = pos.clone().normalize().multiplyScalar(16);
      setFlyTarget({ position: flyPos, href });
    },
    [],
  );

  const handleArrived = useCallback(
    (href: string) => {
      setFlyTarget(null);
      router.push(href);
    },
    [router],
  );

  return (
    <Canvas
      camera={{ position: [0, 14, 36], fov: 52 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ background: "radial-gradient(ellipse at 50% 50%, #181210 0%, #0e0a07 45%, #000000 100%)" }}
    >
      <CameraController target={flyTarget} onArrived={handleArrived} />

      {/* Lighting — dramatic directional from top-right + dim ambient */}
      <ambientLight intensity={0.1} />
      <directionalLight position={[10, 5, 5]} intensity={2.0} color="#fff5dc" />
      <pointLight position={[-8, -4, -6]} intensity={0.4} color="#2244aa" />
      {/* Rim-light — blue glow from Earth core */}
      <pointLight position={[0, 0, 0]} intensity={0.4} color="#88aaff" distance={18} />

      {/* Fog — depth of space */}
      <fog attach="fog" args={["#000005", 100, 250]} />

      {/* Deep star field — three layers for depth */}
      <DeepStarField />

      {/* Earth */}
      <Earth radius={4.5} />

      {/* Satellites */}
      {SATELLITES.map((sat) => (
        <Satellite
          key={sat.name}
          {...sat}
          navigate={navigate}
          onFlyTo={handleSatelliteClick}
        />
      ))}
    </Canvas>
  );
}
