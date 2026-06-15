"use client";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// Оборот глобуса: период в секундах. Меньше = быстрее. Знак минус = «читаемая»
// сторона (надпись AI CREATOR едет навстречу чтению, не против шерсти).
const SPIN_PERIOD = 24;
const SPIN = -((2 * Math.PI) / SPIN_PERIOD);

/**
 * Пояс-надпись «AI CREATOR», прибитый к глобусу (лежит внутри вращающейся
 * группы Земли → крутится вместе с ней). Текст запечён в CanvasTexture — без
 * внешних шрифтов/CDN (доктрина: никаких внешних загрузок в R3F).
 */
function CreatorRing({ radius }: { radius: number }) {
  const texture = useMemo(() => {
    const REPS = 8;
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#C9A961";
    ctx.font = '700 74px Georgia, "Times New Roman", serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const step = canvas.width / REPS;
    for (let i = 0; i < REPS; i++) {
      ctx.fillText("AI  CREATOR", (i + 0.5) * step, canvas.height / 2);
      ctx.fillStyle = "rgba(201,169,97,0.55)";
      ctx.fillText("•", i * step, canvas.height / 2);
      ctx.fillStyle = "#C9A961";
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  const r = radius * 1.04;
  return (
    <mesh>
      <cylinderGeometry args={[r, r, radius * 0.3, 160, 1, true]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.92}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function EarthTextured({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const texture = useTexture("/textures/earth-night.jpg");

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * SPIN;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.6}
          roughness={0.88}
          metalness={0.05}
        />
      </mesh>
      <CreatorRing radius={radius} />
      {/* Inner atmosphere glow */}
      <mesh>
        <sphereGeometry args={[radius * 1.025, 64, 64]} />
        <meshBasicMaterial
          color="#4488ff"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Outer atmosphere haze */}
      <mesh>
        <sphereGeometry args={[radius * 1.055, 48, 48]} />
        <meshBasicMaterial
          color="#3366cc"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function EarthPlain({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * SPIN;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          color="#030c20"
          emissive="#0d2050"
          emissiveIntensity={0.35}
          roughness={0.88}
          metalness={0.05}
        />
      </mesh>
      <CreatorRing radius={radius} />
      {/* Inner atmosphere glow */}
      <mesh>
        <sphereGeometry args={[radius * 1.025, 64, 64]} />
        <meshBasicMaterial
          color="#4488ff"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Outer atmosphere haze */}
      <mesh>
        <sphereGeometry args={[radius * 1.055, 48, 48]} />
        <meshBasicMaterial
          color="#3366cc"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

class EarthErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function Earth({ radius = 3 }: { radius?: number }) {
  return (
    <EarthErrorBoundary fallback={<EarthPlain radius={radius} />}>
      <React.Suspense fallback={<EarthPlain radius={radius} />}>
        <EarthTextured radius={radius} />
      </React.Suspense>
    </EarthErrorBoundary>
  );
}
