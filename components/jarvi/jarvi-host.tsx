"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
  type VRMAnimation,
} from "@pixiv/three-vrm-animation";
import * as THREE from "three";
import type { JarviState } from "./jarvi-engine";

/**
 * 🚶 ДЖАРВИ-ХОСТ — живой полноразмерный аватар, ходящий по нижней кромке сайта
 * (замена углового мишки). Полный рост, ~1/4-1/3 высоты экрана, прозрачный
 * канвас «парит» над страницей.
 *  • idle      → процедурное дыхание/покач + аниме-жесты (VRMA) акцентами (только вне разговора)
 *  • роуминг   → плавно скользит по X вдоль кромки, разворачивается у краёв
 *  • скролл    → подпрыгивает (как живой), наклон «движения»
 *  • клик      → запускает голосовой движок (jarvi-engine) + жест приветствия
 * 🔴 ВСЕГДА СТОИТ — посадку (seated-idle) выпилили: на кромке режет ноги,
 *    в воздухе висит. Pavel забраковал. Стула быть НЕ должно.
 *
 * ЗНАЧКИ СОСТОЯНИЯ — диегетические, над головой, в золоте сайта (НЕ текстовые чипы):
 *  • listening → золотой МИКРОФОН с аурой, пульсирующей от голоса гостя (onInputLevel)
 *  • thinking  → золотая КОМЕТА, скользящая по орбите-нимбу
 *  • speaking  → НИЧЕГО (видно по губам + субтитру)
 * Текст состояния — только на ошибках, и тот в HTML-оверлее (jarvi-host-client).
 *
 * Аватар: public/models/jarvi-butler.vrm. Движения: public/animations/*.vrma
 * (официальный VRoid 7-set, только стоячие жесты). Кредит — в подвале.
 * 🔴 Рецепт хрома без HDR Environment (тот роняет Canvas в РФ) — лампы сцены.
 */

const MODEL_URL = "/models/jarvi-butler.vrm";
const GOLD = "#C9A961";
const SPARK = "#E6C173";
const ANIM = {
  greeting: "/animations/greeting.vrma",
  modelPose: "/animations/model-pose.vrma",
  peace: "/animations/peace.vrma",
};

const registerVRM = (loader: GLTFLoader) => {
  loader.register((parser) => new VRMLoaderPlugin(parser));
};

// ── значки рисуем плоскими иконками на canvas → billboard-спрайт (как на демке) ──
// рисуем в БЕЛОМ, цвет даём через spriteMaterial.color (тинт).
function makeMicTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 140; c.height = 224;
  const g = c.getContext("2d")!;
  g.lineCap = "round"; g.lineJoin = "round";
  const cx = 70, capW = 54, capH = 104, capX = cx - capW / 2, capY = 22, rr = capW / 2;
  // капсула-грилья (скруглённый прямоугольник)
  g.beginPath();
  g.moveTo(capX, capY + rr);
  g.arc(capX + rr, capY + rr, rr, Math.PI, 0);
  g.lineTo(capX + capW, capY + capH - rr);
  g.arc(capX + rr, capY + capH - rr, rr, 0, Math.PI);
  g.closePath();
  g.fillStyle = "rgba(255,255,255,0.16)"; g.fill();
  g.lineWidth = 7; g.strokeStyle = "#ffffff"; g.stroke();
  // полоски грильи
  g.lineWidth = 4; g.strokeStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 3; i++) { const y = capY + 36 + i * 20; g.beginPath(); g.moveTo(capX + 12, y); g.lineTo(capX + capW - 12, y); g.stroke(); }
  // ярмо-дужка под головкой
  g.lineWidth = 7; g.strokeStyle = "#ffffff";
  g.beginPath(); g.arc(cx, capY + capH - 6, capW / 2 + 11, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
  // ножка + основание
  g.beginPath(); g.moveTo(cx, capY + capH + 26); g.lineTo(cx, capY + capH + 56); g.stroke();
  g.beginPath(); g.moveTo(cx - 26, capY + capH + 56); g.lineTo(cx + 26, capY + capH + 56); g.stroke();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.needsUpdate = true; return t;
}
function makeRingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff"; g.lineWidth = 6;
  g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
function makeSparkTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.85)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.45)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.12)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

type HostAction = THREE.AnimationAction;
type StateRef = React.MutableRefObject<JarviState>;
type NumRef = React.MutableRefObject<number>;

function HostAvatar({
  stateRef,
  mouthRef,
  inputRef,
}: {
  stateRef: StateRef;
  mouthRef: NumRef;   // 0..1 амплитуда голоса Джарви (липсинк, от движка)
  inputRef: NumRef;   // 0..1 громкость мика гостя (пульсация значка «слушаю»)
}) {
  const gltf = useLoader(GLTFLoader, MODEL_URL, registerVRM);
  const { camera, size } = useThree();
  const rootRef = useRef<THREE.Group>(null!);

  const mouth = useRef(0);
  const blink = useRef(0);
  const nextBlink = useRef(2);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<Record<string, HostAction>>({});
  const current = useRef<string>("");

  // ── значки состояния (над головой) — плоские иконки billboard-спрайтами ──
  const micGroup = useRef<THREE.Group>(null!);
  const glowSprite = useRef<THREE.Sprite>(null!);
  const micSprite = useRef<THREE.Sprite>(null!);
  const cometGroup = useRef<THREE.Group>(null!);
  const cometGlow = useRef<THREE.Sprite>(null!);
  const sparkSprite = useRef<THREE.Sprite>(null!);
  const cometAngle = useRef(0);
  const tex = useMemo(() => ({ mic: makeMicTexture(), ring: makeRingTexture(), spark: makeSparkTexture(), glow: makeGlowTexture() }), []);
  const cols = useMemo(() => ({ gold: new THREE.Color(GOLD), hot: new THREE.Color("#FFEFC2") }), []);

  // ── роуминг по кромке + подскок по скроллу ──
  const posX = useRef(0);
  const dir = useRef(1); // направление прохода
  const facing = useRef(1); // куда смотрит (1 вправо / -1 влево)
  const bounce = useRef(0);
  const scrollVel = useRef(0);
  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);

  // подготовка VRM (поза, поворот к зрителю, кадрирование в полный рост)
  const { vrm, fit, anchor } = useMemo(() => {
    const v = gltf.userData.vrm as VRM;
    if (!gltf.userData.__hostReady) {
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch {}
      try { VRMUtils.combineSkeletons(gltf.scene); } catch {}
      VRMUtils.rotateVRM0(v); // VRM0 → лицом к +Z (к зрителю)
      v.scene.traverse((o) => { o.frustumCulled = false; });
      gltf.userData.__hostReady = true;
    }
    v.update(0);
    v.scene.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(v.scene);
    const top = box.max.y, bottom = box.min.y;
    const H = Math.max(0.001, top - bottom);
    const fov = 30, dist = 8;
    const viewH = 2 * dist * Math.tan((fov * Math.PI) / 180 / 2);
    // канвас высокий (56vh), но рост держим как при 38vh → над головой воздух под значок.
    const fillFrac = 0.53;               // доля высоты канваса под рост (остальное сверху — место значку)
    const s = (fillFrac * viewH) / H;
    const footY = -(viewH / 2) * 0.95;   // стопы у нижней кромки
    // якорь значка: X по КОСТИ головы (bbox-центр уезжает из-за асимметричной позы),
    // размер — от высоты ГОЛОВЫ (значок ~1/3 головы), не от роста.
    const headNode = v.humanoid?.getRawBoneNode?.("head") || v.humanoid?.getNormalizedBoneNode?.("head");
    let headX = 0, headZ = 0, headH = 0.13 * H;
    if (headNode) { const wp = new THREE.Vector3(); headNode.getWorldPosition(wp); headX = wp.x; headZ = wp.z; headH = Math.max(0.05 * H, top - wp.y); }
    return {
      vrm: v,
      fit: { scale: s, y: footY - bottom * s },
      // значок на ОСИ головы (общие X и Z с костью головы) → держится по центру при повороте
      anchor: { x: headX, y: top + 0.02 * H, z: headZ + 0.06, s: headH * 1.15 },
    };
  }, [gltf]);

  // загрузка VRMA → клипы → миксер
  useEffect(() => {
    let alive = true;
    const loader = new GLTFLoader();
    loader.register((p) => new VRMAnimationLoaderPlugin(p));
    const mixer = new THREE.AnimationMixer(vrm.scene);
    mixerRef.current = mixer;
    const load = async (key: string, url: string) => {
      try {
        const g = await loader.loadAsync(url);
        const arr = (g.userData.vrmAnimations as VRMAnimation[]) || [];
        if (!arr.length || !alive) return;
        const clip = createVRMAnimationClip(arr[0], vrm);
        const act = mixer.clipAction(clip);
        actions.current[key] = act;
      } catch { /* тихо: движение не критично */ }
    };
    Promise.all(Object.entries(ANIM).map(([k, u]) => load(k, u)));
    return () => { alive = false; mixer.stopAllAction(); mixerRef.current = null; };
  }, [vrm]);

  // проиграть жест один раз (поверх процедурного idle), мягкий fade
  const playOnce = (key: string) => {
    const a = actions.current[key];
    if (!a) return;
    const prev = current.current && actions.current[current.current];
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.fadeIn(0.25).play();
    if (prev && prev !== a) prev.fadeOut(0.25);
    current.current = key;
  };
  // скролл → подскок + скорость
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;
      scrollVel.current = scrollVel.current * 0.6 + dy * 0.4;
      bounce.current = Math.min(1.3, bounce.current + Math.abs(dy) * 0.02);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // клик по аватару → жест приветствия (запуск голоса делает клиент-обёртка по тому же клику)
  useEffect(() => {
    const onDown = () => { playOnce("greeting"); };
    const el = document.getElementById("jarvi-host-hit");
    el?.addEventListener("pointerdown", onDown);
    return () => el?.removeEventListener("pointerdown", onDown);
  }, []);

  // авто-жесты в простое (модельная поза / peace) — только ВНЕ разговора
  const gestureTimer = useRef(4);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const t = (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
    mixerRef.current?.update(d);
    // дев-оверрайд состояния для превью значков (set window.__jarviHostState). Снять при проде.
    const dbg = (typeof window !== "undefined")
      ? (window as unknown as { __jarviHostState?: JarviState }).__jarviHostState : undefined;
    const st = dbg ?? stateRef.current;
    const active = st === "listening" || st === "thinking" || st === "speaking";

    // ── роуминг по X вдоль кромки ──
    {
      const halfW = (size.width / size.height) * Math.tan((30 * Math.PI) / 180 / 2) * 8;
      const margin = halfW * 0.34;          // меньше «носит» — узкий дрейф у своего места
      posX.current += dir.current * d * 0.26; // медленнее (нет анимации ходьбы → скольжение неброско)
      if (posX.current > margin) { posX.current = margin; dir.current = -1; }
      if (posX.current < -margin) { posX.current = -margin; dir.current = 1; }
      facing.current += ((dir.current) - facing.current) * 0.06;
    }

    // ── подскок + затухание скорости ──
    bounce.current = Math.max(0, bounce.current - d * 2);
    scrollVel.current *= 0.9;
    const hop = Math.sin(Math.min(bounce.current, 1) * Math.PI) * 0.38;

    // ── авто-жесты в простое — только когда НЕ в разговоре (стоя, не садится) ──
    gestureTimer.current -= d;
    if (gestureTimer.current <= 0) {
      gestureTimer.current = 6 + Math.random() * 4;
      if (!active) playOnce(Math.random() > 0.5 ? "modelPose" : "peace");
    }

    // ── ЛИПСИНК: рот по амплитуде голоса Джарви (от движка) ──
    const target = mouthRef.current > 0 ? mouthRef.current : 0;
    mouth.current += (target - mouth.current) * 0.4;
    nextBlink.current -= d;
    if (nextBlink.current <= 0) { blink.current = 1; nextBlink.current = 2.5 + Math.random() * 3.5; }
    blink.current = Math.max(0, blink.current - d * 9);
    const em = vrm.expressionManager;
    if (em) {
      em.setValue("aa", Math.min(1, Math.max(0, mouth.current)));
      em.setValue("blink", Math.min(1, blink.current));
    }
    if (vrm.lookAt) vrm.lookAt.lookAt(camera.position);

    // ── ЗНАЧКИ СОСТОЯНИЯ над головой (спрайты) ──
    const hh = anchor.s; // высота головы
    if (micGroup.current) {
      // микрофон = постоянное приглашение «нажми — поговори»: висит в покое (off/idle)
      // тихо светясь, и РАЗГОРАЕТСЯ/пульсирует, когда реально слушает.
      const listening = st === "listening";
      micGroup.current.visible = listening || st === "idle" || st === "off";
      if (micGroup.current.visible) {
        const breathe = 0.5 + 0.5 * Math.sin(t * 2.6);
        const lvl = listening ? inputRef.current : 0;
        const amp = listening ? 1 : 0.45;                    // в покое тише
        const p = listening ? Math.min(1, breathe * 0.7 + lvl) : 0.15 * breathe;
        if (glowSprite.current) {
          const g = 0.9 * hh * (1 + (0.4 * breathe + 0.7 * lvl) * amp);
          glowSprite.current.scale.set(g, g, 1);
          (glowSprite.current.material as THREE.SpriteMaterial).opacity = (0.2 + 0.4 * breathe + 0.5 * lvl) * amp + (listening ? 0 : 0.1);
        }
        if (micSprite.current) {  // сам микрофон пульсирует золотом (к тёплому на пике)
          (micSprite.current.material as THREE.SpriteMaterial).color.copy(cols.gold).lerp(cols.hot, 0.2 + 0.8 * p);
        }
      }
    }
    if (cometGroup.current) {
      cometGroup.current.visible = st === "thinking";
      if (cometGroup.current.visible) {
        cometAngle.current -= d * 3.0;
        const R = 0.21 * hh, cyy = 0.48 * hh;
        if (sparkSprite.current) sparkSprite.current.position.set(Math.cos(cometAngle.current) * R, cyy + Math.sin(cometAngle.current) * R, 0.02);
        if (cometGlow.current) {  // то же свечение, что у микрофона (мягко дышит)
          const breathe = 0.5 + 0.5 * Math.sin(t * 2.6);
          const g = 0.85 * hh * (1 + 0.3 * breathe);
          cometGlow.current.scale.set(g, g, 1);
          (cometGlow.current.material as THREE.SpriteMaterial).opacity = 0.28 + 0.32 * breathe;
        }
      }
    }

    // ── применяем позицию/разворот/подскок к корню ──
    if (rootRef.current) {
      rootRef.current.position.x = posX.current;
      rootRef.current.position.y = fit.y + hop;
      rootRef.current.rotation.y = facing.current * 0.42 + Math.sin(t * 0.5) * 0.04;
      rootRef.current.rotation.z = Math.sin(t * 0.8) * 0.012; // лёгкое дыхание-покач
    }
    vrm.update(d);
  });

  return (
    <group ref={rootRef} position={[0, fit.y, 0]} scale={fit.scale}>
      <primitive object={vrm.scene} />

      {/* значки состояния — над головой, плоские иконки billboard-спрайтами (hh = высота головы) */}
      <group position={[anchor.x, anchor.y, anchor.z]}>
        {/* СЛУШАЮ — иконка микрофона + мягкое пульсирующее СВЕЧЕНИЕ (additive) */}
        <group ref={micGroup} visible={false}>
          <sprite ref={glowSprite} position={[0, 0.42 * anchor.s, 0]} scale={[0.95 * anchor.s, 0.95 * anchor.s, 1]}>
            <spriteMaterial map={tex.glow} color={GOLD} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite ref={micSprite} position={[0, 0.37 * anchor.s, 0]} scale={[0.4 * anchor.s, 0.64 * anchor.s, 1]}>
            <spriteMaterial map={tex.mic} color={GOLD} transparent depthWrite={false} />
          </sprite>
        </group>

        {/* ДУМАЮ — комета по орбите + то же свечение, что у микрофона */}
        <group ref={cometGroup} visible={false}>
          <sprite ref={cometGlow} position={[0, 0.48 * anchor.s, 0]} scale={[0.85 * anchor.s, 0.85 * anchor.s, 1]}>
            <spriteMaterial map={tex.glow} color={GOLD} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite position={[0, 0.48 * anchor.s, 0]} scale={[0.5 * anchor.s, 0.5 * anchor.s, 1]}>
            <spriteMaterial map={tex.ring} color={GOLD} transparent opacity={0.25} depthWrite={false} />
          </sprite>
          <sprite ref={sparkSprite} position={[0, 0.48 * anchor.s, 0.02]} scale={[0.17 * anchor.s, 0.17 * anchor.s, 1]}>
            <spriteMaterial map={tex.spark} color={SPARK} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      </group>
    </group>
  );
}

function Fallback() {
  const r = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (r.current) r.current.rotation.z = clock.elapsedTime * 0.5; });
  return (
    <mesh ref={r} position={[0, 0, 0]}>
      <torusGeometry args={[1.4, 0.008, 8, 80]} />
      <meshBasicMaterial color={GOLD} transparent opacity={0.35} />
    </mesh>
  );
}

export function JarviHostCanvas({
  stateRef,
  mouthRef,
  inputRef,
}: {
  stateRef: StateRef;
  mouthRef: NumRef;
  inputRef: NumRef;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 5]} intensity={1.3} color="#fff5dc" />
      <directionalLight position={[-3, 1, 2]} intensity={0.5} color={GOLD} />
      <Suspense fallback={<Fallback />}>
        <HostAvatar stateRef={stateRef} mouthRef={mouthRef} inputRef={inputRef} />
      </Suspense>
    </Canvas>
  );
}

(useLoader as unknown as { preload: (l: typeof GLTFLoader, u: string, e: (l: GLTFLoader) => void) => void }).preload?.(GLTFLoader, MODEL_URL, registerVRM);
