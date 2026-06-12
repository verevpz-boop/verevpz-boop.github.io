"use client";
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DeepStarField } from "../three/deep-star-field";
import type { JarviState } from "./jarvi-engine";

/**
 * Голова Джарви — живая версия макета signature-head (донор по TZ_JARVI.md).
 * Состояния приходят из движка через ref (без ре-рендеров R3F-сцены).
 * Рот этажа А — процедурный (speechSynthesis аудиопоток не отдаёт, §7 ТЗ).
 */

export type JarviDriver = { state: JarviState; mouth: number }; // mouth 0..1 (живой липсинк, этаж Б; <0 = режим не активен)

const STATE_COLOR: Record<string, string> = {
  off: "#4a4434",
  idle: "#7a6a3a",
  listening: "#3fb6c9",
  thinking: "#c98a3f",
  speaking: "#C9A961",
  sleeping: "#5a4a4a",
  denied: "#8a3d3d",
};

function Head({ driver }: { driver: React.MutableRefObject<JarviDriver> }) {
  const group = useRef<THREE.Group>(null!);
  const mouth = useRef<THREE.Mesh>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);
  const wireMat = useRef<THREE.LineBasicMaterial>(null!);

  const geo = useMemo(() => new THREE.IcosahedronGeometry(2, 2), []);
  const wireGeo = useMemo(() => new THREE.WireframeGeometry(geo), [geo]);
  const curColor = useMemo(() => new THREE.Color(STATE_COLOR.idle), []);
  const tilt = useRef(0); // плавный «наклон внимания» при слушании

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const state = driver.current.state;

    // дыхание + лёгкий дрейф (микрожизнь-минимум; первая под нож по ТЗ — оставлен самый дешёвый слой)
    if (group.current) {
      group.current.rotation.y = Math.sin(time * 0.5) * 0.16;
      const targetTilt = state === "listening" ? 0.1 : 0;
      tilt.current += (targetTilt - tilt.current) * 0.08;
      group.current.rotation.x = Math.sin(time * 0.33) * 0.05 + tilt.current;
      group.current.scale.setScalar(1 + Math.sin(time * 1.6) * 0.012);
    }

    curColor.lerp(new THREE.Color(STATE_COLOR[state] || STATE_COLOR.idle), 0.08);
    if (wireMat.current) wireMat.current.color.copy(curColor);

    // рот: живой режим (mouth>=0) → амплитуда реального аудио (настоящий липсинк);
    // иначе процедурная речь по состоянию.
    let open = 0.05;
    const liveMouth = driver.current.mouth;
    if (state === "speaking" && liveMouth >= 0) {
      open = 0.06 + liveMouth * 0.6;
    } else if (state === "speaking") {
      const a = Math.abs(Math.sin(time * 12.0));
      const b = 0.5 + 0.5 * Math.sin(time * 5.7 + 1.0);
      open = 0.08 + a * b * 0.5;
    } else if (state === "thinking") {
      open = 0.05 + Math.max(0, Math.sin(time * 3.0)) * 0.03;
    }
    if (mouth.current) mouth.current.scale.y += (open - mouth.current.scale.y) * 0.5;

    if (haloRef.current) {
      const active = state === "speaking" || state === "listening";
      const pulse = 1 + Math.sin(time * (state === "thinking" ? 5 : 3)) * (active ? 0.06 : 0.02);
      haloRef.current.scale.setScalar(pulse);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        (active ? 0.14 : 0.07) + Math.sin(time * 3.0) * 0.03;
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={geo}>
        <meshBasicMaterial color="#0a0a0a" transparent opacity={0.55} />
      </mesh>
      <lineSegments geometry={wireGeo}>
        <lineBasicMaterial ref={wireMat} color={STATE_COLOR.idle} transparent opacity={0.9} />
      </lineSegments>

      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.35, 1.75]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshBasicMaterial color="#fff4d8" />
        </mesh>
      ))}

      <mesh ref={mouth} position={[0, -0.55, 1.78]} scale={[1, 0.05, 1]}>
        <boxGeometry args={[0.9, 1.0, 0.12]} />
        <meshBasicMaterial color="#ffdf9e" />
      </mesh>

      <mesh ref={haloRef} position={[0, -0.2, -0.6]} rotation={[1.28, 0, 0.22]}>
        <torusGeometry args={[2.9, 0.018, 8, 90]} />
        <meshBasicMaterial color="#C9A961" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

export function JarviHeadCanvas({ driver }: { driver: React.MutableRefObject<JarviDriver> }) {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 45 }} gl={{ antialias: true }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 8]} intensity={1.2} color="#fff5dc" />
      <pointLight position={[-5, -2, 6]} intensity={0.6} color="#C9A961" />
      <DeepStarField />
      <Head driver={driver} />
    </Canvas>
  );
}
