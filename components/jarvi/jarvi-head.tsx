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
const ARM_Z = 1.3; // базовый угол опускания плеч из T-позы (рад); анимация качает вокруг него

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
  const talkAmp = useRef(0);        // сглаженная «громкость» жестикуляции (0 покой → 1 речь)

  // Один раз готовим VRM: чистим, разворачиваем лицом к камере (VRM0 смотрит в −Z),
  // ставим спокойную позу, ловим кости корпуса/рук для анимации, считаем кадрирование.
  const { vrm, fit, bones } = useMemo(() => {
    const v = gltf.userData.vrm as VRM;
    const g = (name: Parameters<typeof v.humanoid.getNormalizedBoneNode>[0]) =>
      v.humanoid.getNormalizedBoneNode(name);
    if (!gltf.userData.__jarviReady) {
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch {}
      try { VRMUtils.combineSkeletons(gltf.scene); } catch {}
      VRMUtils.rotateVRM0(v);                       // VRM0.0 → повернуть лицом к +Z (к зрителю)
      v.scene.traverse((o) => { o.frustumCulled = false; });
      // из дефолтной T-позы → спокойный idle: опустить руки вдоль корпуса
      const la = g("leftUpperArm"); if (la) la.rotation.z = ARM_Z;
      const ra = g("rightUpperArm"); if (ra) ra.rotation.z = -ARM_Z;
      const lla = g("leftLowerArm"); if (lla) lla.rotation.z = 0.18;
      const rla = g("rightLowerArm"); if (rla) rla.rotation.z = -0.18;
      gltf.userData.__jarviReady = true;
    }
    v.update(0);

    // кадрирование: крупный портрет, голова опущена ниже верха кадра (не цепляет надпись «ДЖАРВИ»)
    const box = new THREE.Box3().setFromObject(v.scene);
    const top = box.max.y;                 // макушка
    const bottom = box.min.y;              // стопы
    const H = Math.max(0.001, top - bottom);
    const center = new THREE.Vector3(); box.getCenter(center);

    const fov = 42, dist = 7;
    const viewH = 2 * dist * Math.tan((fov * Math.PI) / 180 / 2);
    const visible = 0.40 * H;              // меньше доля роста в кадре = крупнее лицо
    const s = (viewH * 0.92) / visible;    // масштаб под кадр
    const headTopY = (viewH / 2) * 0.52;   // макушка заметно ниже верха кадра — под надписью
    const bones = { spine: g("spine"), chest: g("chest") || g("upperChest"), la: g("leftUpperArm"), ra: g("rightUpperArm") };
    return {
      vrm: v,
      fit: { scale: s, x: -center.x * s, y: headTopY - top * s },
      bones,
    };
  }, [gltf]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const t = (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
    const state = driver.current.state;
    const speaking = state === "speaking";

    // ── ЛИПСИНК: открытие рта по амплитуде реального аудио ──
    const live = driver.current.mouth;
    const test = (typeof window !== "undefined")
      ? (window as unknown as { __jarviMouthTest?: number }).__jarviMouthTest : undefined;
    let target = 0;
    if (typeof test === "number") target = test;
    else if (speaking && live >= 0) target = live;
    else if (speaking) target = 0.25 + 0.25 * Math.abs(Math.sin(t * 11));
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

    // ── ВЗГЛЯД на зрителя ──
    if (vrm.lookAt) vrm.lookAt.lookAt(camera.position);

    // ── ЖИВОЕ ТЕЛО: дыхание + покач, в речи — заметнее (корпус и руки не «деревянные») ──
    talkAmp.current += ((speaking ? 1 : 0) - talkAmp.current) * 0.06;
    const k = talkAmp.current;
    if (bones.spine) {
      bones.spine.rotation.z = Math.sin(t * 0.7) * 0.02 + Math.sin(t * 2.1) * 0.025 * k;
      bones.spine.rotation.x = Math.sin(t * 1.1) * 0.012 + Math.abs(Math.sin(t * 4.5)) * 0.03 * k;
    }
    if (bones.chest) bones.chest.rotation.x = Math.sin(t * 1.2) * 0.01; // дыхание
    if (bones.la) {
      bones.la.rotation.z = ARM_Z + Math.sin(t * 0.9) * 0.03 + Math.sin(t * 3.7) * 0.06 * k;
      bones.la.rotation.x = Math.sin(t * 0.8) * 0.03 + Math.sin(t * 3.2) * 0.08 * k;
    }
    if (bones.ra) {
      bones.ra.rotation.z = -ARM_Z + Math.sin(t * 0.9 + 1) * 0.03 - Math.sin(t * 4.0) * 0.06 * k;
      bones.ra.rotation.x = Math.sin(t * 0.8 + 0.5) * 0.03 + Math.sin(t * 3.5) * 0.08 * k;
    }
    if (root.current) {
      root.current.rotation.y = Math.sin(t * 0.5) * 0.05;
      root.current.position.y = fit.y + Math.sin(t * 1.2) * 0.02; // дыхание корпусом
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
