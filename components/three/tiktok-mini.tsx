"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Мини-«мишка с плитками» — компактная версия страницы /tiktok для плитки
 * на /work: хромированный BearBrick в центре, вокруг по сфере вращаются мелкие
 * 9:16-плитки с TikTok-постерами. Клик по плитке-обёртке → перелёт на /tiktok
 * (большой мишка + живые клипы).
 *
 * 🔴 Рецепт хрома — как в tiktok-canvas (НЕ как угловой BearBrick): emissive +
 * лампы сцены, БЕЗ <Environment preset> (он тянет HDR с CDN pmndrs → в РФ флапает
 * и роняет весь Canvas в черноту без ошибки в консоли). Плитки — статичные
 * постеры (лёгкие), без видео-стримов: мини нужен как намёк, не как плеер.
 */

const MODEL = "/models/bearbrick.glb.glb";

// Постеры TikTok-клипов для орбитальных плиток (public/posters/tiktok).
const PLATE_POSTERS = [
  "/posters/tiktok/golos.jpg",
  "/posters/tiktok/smeh_100.jpg",
  "/posters/tiktok/face_01.jpg",
  "/posters/tiktok/iceland_master.jpg",
  "/posters/tiktok/material-woman.jpg",
  "/posters/tiktok/v3.jpg",
  "/posters/tiktok/racing-speeders.jpg",
];

// Хром-материалы (РФ-безопасные: emissive вместо HDR-окружения).
const chromeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#E8E8E8"),
  metalness: 0.55,
  roughness: 0.18,
  emissive: new THREE.Color("#2a2a2a"),
});
const darkMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#0a0a0a"),
  metalness: 0.2,
  roughness: 0.3,
});

function Bear() {
  const { scene } = useGLTF(MODEL);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null!);

  useEffect(() => {
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const name = (child.name ?? "").toLowerCase();
      const isDark =
        name.includes("body") || name.includes("torso") ||
        name.includes("chest") || name.includes("upper");
      child.material = (isDark ? darkMat : chromeMat).clone();
      child.castShadow = false;
    });
  }, [cloned]);

  const fitScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return 2.3 / maxDim;
  }, [cloned]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });

  return (
    <group ref={ref} scale={fitScale}>
      <primitive object={cloned} scale={[1.15, 0.92, 1.18]} dispose={null} />
    </group>
  );
}

function Plates() {
  const group = useRef<THREE.Group>(null!);

  const textures = useMemo(() => {
    if (typeof document === "undefined") return [];
    const loader = new THREE.TextureLoader();
    return PLATE_POSTERS.map((p) => {
      const t = loader.load(p);
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      return t;
    });
  }, []);

  // Позиции по фибоначчи-сфере (как на большой странице, но мельче и без видео).
  const positions = useMemo(() => {
    const n = PLATE_POSTERS.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const R = 2.05;
    return Array.from({ length: n }, (_, i) => {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const y = 1 - t * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      return new THREE.Vector3(Math.cos(theta) * r * R, y * R * 0.85, Math.sin(theta) * r * R);
    });
  }, []);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.32;
  });

  const W = 0.5;
  const H = W * (16 / 9);

  if (!textures.length) return null;
  return (
    <group ref={group}>
      {positions.map((p, i) => (
        <mesh
          key={i}
          position={p}
          ref={(o: THREE.Mesh | null) => { if (o) o.lookAt(0, 0, 0); }}
        >
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial map={textures[i]} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function TikTokMini() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 3, 4]} intensity={1.3} color="#fff5dc" />
      <directionalLight position={[-3, -2, -2]} intensity={0.5} color="#88aaff" />
      <Bear />
      <Plates />
    </Canvas>
  );
}

useGLTF.preload(MODEL);
