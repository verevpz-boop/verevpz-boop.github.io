"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DeepStarField } from "../three/deep-star-field";
import type { JarviState } from "./jarvi-engine";

/**
 * Голова Джарви — wireframe ЧЕЛОВЕЧЕСКОЙ головы по референсу
 * docs/refs/signature-head-reference.md: quad-mesh каркас, светящиеся глаза,
 * золото сайта #C9A961, ЗАМЕТНЫЙ липсинк (нижняя челюсть сетки опускается под речь).
 * Модель: public/models/LeePerrySmith.glb (классическая 3D-голова three.js).
 * Состояния приходят из движка через ref (без ре-рендеров R3F-сцены).
 */

export type JarviDriver = { state: JarviState; mouth: number }; // mouth 0..1 (живой липсинк; <0 = режим не активен)

const GOLD = "#C9A961";
const STATE_TINT: Record<string, string> = {
  off: "#6b5f3a",
  idle: "#8a7a44",
  listening: "#3fb6c9",   // слушаю — холодный циан
  thinking: "#c98a3f",    // думаю — янтарь
  speaking: "#C9A961",    // говорю — золото
  sleeping: "#7a5a5a",
  denied: "#9a4040",
};

const TARGET_HEIGHT = 4.2;   // подгон головы под кадр
const JAW_MAX_DROP = 0.55;   // насколько опускается челюсть на максимуме амплитуды (в юнитах модели до масштаба)

function HumanHead({ driver }: { driver: React.MutableRefObject<JarviDriver> }) {
  const { scene } = useGLTF("/models/LeePerrySmith.glb");
  const group = useRef<THREE.Group>(null!);
  const wireMat = useRef<THREE.MeshBasicMaterial>(null!);
  const curColor = useMemo(() => new THREE.Color(STATE_TINT.idle), []);
  const tilt = useRef(0);

  // Достаём геометрию первого меша, центрируем, считаем вес челюсти на вершину.
  const { geo, basePos, jawWeight, dims, eyeL, eyeR } = useMemo(() => {
    let srcGeo: THREE.BufferGeometry | null = null;
    scene.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && !srcGeo) srcGeo = m.geometry; });
    const g = (srcGeo as unknown as THREE.BufferGeometry).clone();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const center = new THREE.Vector3(); bb.getCenter(center);
    const size = new THREE.Vector3(); bb.getSize(size);
    // центрируем в начало координат
    g.translate(-center.x, -center.y, -center.z);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const base = new Float32Array(pos.array as Float32Array); // копия исходных позиций (центрированных)

    // вес челюсти: только ПОЛОСА рот→подбородок и только ПЕРЁД лица (z>0).
    // NB: b.min.y = низ плеч, НЕ подбородок — поэтому пороги в долях size.y, а не от bbox.
    const mouthY = 0.16 * size.y;   // уровень рта/нижней губы (выше центра — плечи тянут центр вниз)
    const chinY = 0.02 * size.y;    // низ подбородка; ниже — шея/грудь, не трогаем
    const zFront = 0.0;             // только передние вершины
    const jw = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const y = base[i * 3 + 1];
      const z = base[i * 3 + 2];
      if (y >= chinY && y <= mouthY && z > zFront) {
        // подбородок (ближе к chinY) опускается сильнее, у линии рта — почти ноль (ось поворота челюсти)
        const t = (mouthY - y) / (mouthY - chinY); // 0 у рта → 1 у подбородка
        jw[i] = t * t * (3 - 2 * t);
      }
    }
    return {
      geo: g, basePos: base, jawWeight: jw,
      dims: { sx: size.x, sy: size.y, sz: size.z },
      // светящиеся глаза, утоплены в глазницы. NB: bbox включает плечи → глаза ВЫШЕ центра
      // (выверено по скриншоту: y≈0.22 от полной высоты, x узко т.к. ширина = плечи).
      eyeL: new THREE.Vector3(-0.10 * size.x, 0.22 * size.y, 0.16 * size.z),
      eyeR: new THREE.Vector3(0.10 * size.x, 0.22 * size.y, 0.16 * size.z),
    };
  }, [scene]);

  const fit = TARGET_HEIGHT / dims.sy;

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const state = driver.current.state;

    if (group.current) {
      group.current.rotation.y = Math.sin(time * 0.5) * 0.12;
      const targetTilt = state === "listening" ? 0.08 : 0;
      tilt.current += (targetTilt - tilt.current) * 0.08;
      group.current.rotation.x = Math.sin(time * 0.33) * 0.04 + tilt.current;
    }

    curColor.lerp(new THREE.Color(STATE_TINT[state] || STATE_TINT.idle), 0.08);
    if (wireMat.current) wireMat.current.color.copy(curColor);

    // ── ЛИПСИНК: опускаем челюсть по амплитуде реального аудио ──
    const live = driver.current.mouth;
    let open = 0;
    const test = (typeof window !== "undefined") ? (window as unknown as { __jarviMouthTest?: number }).__jarviMouthTest : undefined;
    if (typeof test === "number") open = test; // тест-хук для проверки липсинка на скриншоте
    else if (state === "speaking" && live >= 0) open = live;
    else if (state === "speaking") open = 0.25 + 0.25 * Math.abs(Math.sin(time * 11)); // фоллбэк процедурно
    else if (state === "thinking") open = 0.04 * Math.max(0, Math.sin(time * 3));

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const drop = open * JAW_MAX_DROP;
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      const w = jawWeight[i];
      if (w === 0) continue;
      arr[i * 3 + 1] = basePos[i * 3 + 1] - drop * w;        // вниз
      arr[i * 3 + 2] = basePos[i * 3 + 2] - drop * w * 0.25; // чуть назад (поворот челюсти)
      changed = true;
    }
    if (changed) pos.needsUpdate = true;
  });

  return (
    <group ref={group} scale={fit}>
      {/* каркас человеческой головы */}
      <mesh geometry={geo}>
        <meshBasicMaterial ref={wireMat} color={GOLD} wireframe transparent opacity={0.85} />
      </mesh>
      {/* лёгкий тёмный объём внутри — глубина, чтобы задние рёбра не «просвечивали» в кашу */}
      <mesh geometry={geo} scale={0.985}>
        <meshBasicMaterial color="#0a0a0a" transparent opacity={0.6} />
      </mesh>
      {/* светящиеся глаза: яркое ядро + мягкое гало */}
      {[eyeL, eyeR].map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh>
            <sphereGeometry args={[0.02 * dims.sx, 16, 16]} />
            <meshBasicMaterial color="#fff6e0" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.042 * dims.sx, 16, 16]} />
            <meshBasicMaterial color="#ffe6a8" transparent opacity={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

useGLTF.preload("/models/LeePerrySmith.glb");

function HeadFallback() {
  // пока грузится GLB — тонкое золотое кольцо, не пустота
  const r = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (r.current) r.current.rotation.z = clock.elapsedTime * 0.5; });
  return (
    <mesh ref={r}>
      <torusGeometry args={[1.6, 0.01, 8, 80]} />
      <meshBasicMaterial color={GOLD} transparent opacity={0.4} />
    </mesh>
  );
}

export function JarviHeadCanvas({ driver }: { driver: React.MutableRefObject<JarviDriver> }) {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 42 }} gl={{ antialias: true }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 8]} intensity={1.0} color="#fff5dc" />
      <DeepStarField />
      <Suspense fallback={<HeadFallback />}>
        <HumanHead driver={driver} />
      </Suspense>
    </Canvas>
  );
}
