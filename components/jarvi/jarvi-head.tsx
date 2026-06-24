"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import * as THREE from "three";
import { DeepStarField } from "../three/deep-star-field";
import type { JarviState } from "./jarvi-engine";

/**
 * Голова/аватар Джарви — готовый VRM-герой «Savi Butler» (VRoid Hub, лицензия чистая).
 * Заменил прежнюю wireframe-голову: теперь полноценный риг через @pixiv/three-vrm.
 * Движок jarvi-engine.ts НЕ трогаем — он кормит driver.mouth (0..1, <0 = молчит)
 * и driver.state. Здесь это превращается в:
 *   • липсинк      → VRM expression 'aa' (рот) по амплитуде реального аудио
 *   • моргание     → expression 'blink' по таймеру
 *   • взгляд       → vrm.lookAt в камеру (смотрит на зрителя)
 *   • idle         → лёгкий покач корпуса + «дыхание»
 *   • состояние    → цвет рим-света (слушаю/думаю/говорю...)
 * Модель: public/models/jarvi-butler.vrm (Savi Butler Outfit, VRM 0.0).
 */

export type JarviDriver = { state: JarviState; mouth: number }; // mouth 0..1 (живой липсинк; <0 = режим не активен)

const MODEL_URL = "/models/jarvi-butler.vrm";

const GOLD = "#C9A961";
// цвет рим-света по состоянию — «живые» режимы как у прежней головы
const STATE_TINT: Record<string, string> = {
  off: "#6b5f3a",
  idle: "#8a7a44",
  listening: "#3fb6c9",   // слушаю — холодный циан
  thinking: "#c98a3f",    // думаю — янтарь
  speaking: "#C9A961",    // говорю — золото
  sleeping: "#7a5a5a",
  denied: "#9a4040",
};

const registerVRM = (loader: GLTFLoader) => {
  loader.register((parser) => new VRMLoaderPlugin(parser));
};

function ButlerAvatar({ driver }: { driver: React.MutableRefObject<JarviDriver> }) {
  const gltf = useLoader(GLTFLoader, MODEL_URL, registerVRM);
  const camera = useThree((s) => s.camera);
  const root = useRef<THREE.Group>(null!);
  const rim = useRef<THREE.PointLight>(null!);
  const curColor = useMemo(() => new THREE.Color(STATE_TINT.idle), []);
  const mouth = useRef(0);          // сглаженное открытие рта
  const blink = useRef(0);          // текущее значение моргания
  const nextBlink = useRef(1.5);    // время следующего моргания

  // Один раз готовим VRM: чистим, разворачиваем лицом к камере (VRM0 смотрит в −Z),
  // считаем кадрирование «по пояс» из bbox.
  const { vrm, fit } = useMemo(() => {
    const v = gltf.userData.vrm as VRM;
    if (!gltf.userData.__jarviReady) {
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch {}
      try { VRMUtils.combineSkeletons(gltf.scene); } catch {}
      VRMUtils.rotateVRM0(v);                       // VRM0.0 → повернуть лицом к +Z (к зрителю)
      v.scene.traverse((o) => { o.frustumCulled = false; });
      // из дефолтной T-позы → спокойный idle: опустить руки вдоль корпуса
      const setBone = (name: Parameters<typeof v.humanoid.getNormalizedBoneNode>[0], z: number) => {
        const n = v.humanoid.getNormalizedBoneNode(name);
        if (n) n.rotation.z = z;
      };
      setBone("leftUpperArm", 1.25);
      setBone("rightUpperArm", -1.25);
      setBone("leftLowerArm", 0.18);
      setBone("rightLowerArm", -0.18);
      gltf.userData.__jarviReady = true;
    }
    v.update(0);

    // кадрирование: показать грудь-плечи-голову (лицо читаемо: липсинк/моргание/взгляд)
    const box = new THREE.Box3().setFromObject(v.scene);
    const top = box.max.y;                 // макушка
    const bottom = box.min.y;              // стопы
    const H = Math.max(0.001, top - bottom);
    const center = new THREE.Vector3(); box.getCenter(center);

    const fov = 42, dist = 7;
    const viewH = 2 * dist * Math.tan((fov * Math.PI) / 180 / 2);
    const visible = 0.5 * H;               // верхняя половина роста (голова→пояс)
    const s = (viewH * 0.92) / visible;    // масштаб под кадр
    const headTopY = (viewH / 2) * 0.86;   // куда поставить макушку (чуть ниже верха кадра)
    return {
      vrm: v,
      fit: { scale: s, x: -center.x * s, y: headTopY - top * s },
    };
  }, [gltf]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const t = (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
    const state = driver.current.state;

    // ── ЛИПСИНК: открытие рта по амплитуде реального аудио ──
    const live = driver.current.mouth;
    const test = (typeof window !== "undefined")
      ? (window as unknown as { __jarviMouthTest?: number }).__jarviMouthTest : undefined;
    let target = 0;
    if (typeof test === "number") target = test;
    else if (state === "speaking" && live >= 0) target = live;
    else if (state === "speaking") target = 0.25 + 0.25 * Math.abs(Math.sin(t * 11));
    mouth.current += (target - mouth.current) * 0.4;

    // ── МОРГАНИЕ по таймеру (быстрое закрытие-открытие) ──
    nextBlink.current -= d;
    if (nextBlink.current <= 0) {
      blink.current = 1;
      nextBlink.current = 2.5 + Math.random() * 3.5;
    }
    blink.current = Math.max(0, blink.current - d * 9);

    const em = vrm.expressionManager;
    if (em) {
      em.setValue("aa", Math.min(1, Math.max(0, mouth.current)));
      em.setValue("blink", Math.min(1, blink.current));
    }

    // ── ВЗГЛЯД на зрителя + лёгкий idle-покач/«дыхание» ──
    if (vrm.lookAt) vrm.lookAt.lookAt(camera.position);
    if (root.current) {
      root.current.rotation.y = Math.sin(t * 0.5) * 0.06;
      root.current.position.y = fit.y + Math.sin(t * 1.2) * 0.015; // дыхание
    }
    vrm.update(d);

    // ── цвет рим-света по состоянию ──
    curColor.lerp(new THREE.Color(STATE_TINT[state] || STATE_TINT.idle), 0.08);
    if (rim.current) rim.current.color.copy(curColor);
  });

  return (
    <group ref={root} position={[fit.x, fit.y, 0]} scale={fit.scale}>
      <primitive object={vrm.scene} />
      {/* рим-свет состояния — сбоку-сзади, подсвечивает силуэт цветом режима */}
      <pointLight ref={rim} position={[-1.2, 1.6, -0.8]} intensity={6} distance={8} color={STATE_TINT.idle} />
    </group>
  );
}

useLoader.preload(GLTFLoader, MODEL_URL, registerVRM);

function HeadFallback() {
  // пока грузится VRM — тонкое золотое кольцо, не пустота
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
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 5]} intensity={1.4} color="#fff5dc" />
      <pointLight position={[5, 5, 8]} intensity={0.8} color="#fff5dc" />
      <DeepStarField />
      <Suspense fallback={<HeadFallback />}>
        <ButlerAvatar driver={driver} />
      </Suspense>
    </Canvas>
  );
}
