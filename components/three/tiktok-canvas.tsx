"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { R2_VIDEOS } from "@/lib/videos";

/* ─── reduced-motion detection ────────────────────────────────────────── */
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── damped spring helper (frame-rate independent) ───────────────────── */
type SpringState = { velocity: number };
function springStep(
  current: number,
  target: number,
  vel: SpringState,
  stiffness: number,
  damping: number,
  delta: number,
): number {
  vel.velocity += (target - current) * stiffness * delta;
  vel.velocity *= Math.pow(damping, delta * 60);
  return current + vel.velocity * delta;
}

/* ─── R2 brand films + local clips + photos ──────────────────────────────
 * The R2 videos are referenced by URL only (never bundled) via lib/videos.ts.
 * These are the "little screens" that fly around the BearBrick — they now
 * play Pavel's real R2 brand films, distributed by the page→brand mapping:
 *   Master Dynamic / Venice → cinema, LIME → fashion, "с голосом" → dance.
 */
type Source =
  | { type: "video"; src: string }
  | { type: "image"; src: string }
  | { type: "black" };

// 🔴 На странице TikTok висит ТОЛЬКО категория tiktok/ с R2 (Pavel).
// Корневые fashion/cinema-фильмы и локальные клипы v1–v8 убраны.
const _videos: Source[] = [
  { type: "video" as const, src: R2_VIDEOS.smeh100 },
  { type: "video" as const, src: R2_VIDEOS.icelandMaster },
  { type: "video" as const, src: R2_VIDEOS.islandMaster },
  { type: "video" as const, src: R2_VIDEOS.smeh0401 },
  { type: "video" as const, src: R2_VIDEOS.smeh0424tiktok },
  { type: "video" as const, src: R2_VIDEOS.face01 },
  { type: "video" as const, src: R2_VIDEOS.openartTiktok },
  { type: "video" as const, src: R2_VIDEOS.creationPolic4Tiktok },
];

// Только клипы tiktok/ (Pavel): фото и чужие категории убраны. Пара чёрных
// заглушек под будущие клипы; Pavel доввесит — тогда поднять число.
const SPHERE_TILES = 14;
const SOURCES: Source[] = (() => {
  const out: Source[] = [..._videos];
  while (out.length < SPHERE_TILES) out.push({ type: "black" as const });
  return out;
})();

const VIDEO_INDICES = SOURCES.flatMap((s, i) => (s.type === "video" ? [i] : []));

/* ─── geometry tunables (perf-optimized) ─────────────────────────────── */
const SPHERE_RADIUS = 4.25;
const TILE_W = 0.95;
const TILE_H = TILE_W * (16 / 9);             // proper 9:16
const TILE_DEPTH = 0.045;                       // card thickness
// 42 unique sources = 42 tiles, no repetition
const TILE_COUNT = SOURCES.length;
const SCROLL_PAGES = 4;

// Мировые оси для трекбол-вращения (фиксированы относительно экрана).
const WORLD_X = new THREE.Vector3(1, 0, 0);
const WORLD_Y = new THREE.Vector3(0, 1, 0);

/* ─── shared bundles — one entry per SOURCES item ─────────────────────── */
type Bundle =
  | { type: "video"; video: HTMLVideoElement; texture: THREE.VideoTexture }
  | { type: "image"; texture: THREE.Texture }
  | { type: "black" };

function useBundles(): Bundle[] {
  return useMemo(() => {
    if (typeof document === "undefined") return [];
    const loader = new THREE.TextureLoader();
    return SOURCES.map((s) => {
      if (s.type === "video") {
        // Eager src + preload metadata, but actual fetch is gated by stagger
        const v = document.createElement("video");
        v.src = s.src;
        v.crossOrigin = "anonymous";
        v.loop = true;
        v.muted = true;
        v.playsInline = true;
        v.autoplay = false;
        v.preload = "metadata";
        const tex = new THREE.VideoTexture(v);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        return { type: "video" as const, video: v, texture: tex };
      } else if (s.type === "image") {
        const tex = loader.load(s.src);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return { type: "image" as const, texture: tex };
      } else {
        // чёрная заглушка — пустой слот под будущий клип
        return { type: "black" as const };
      }
    });
  }, []);
}

/* ─── fibonacci sphere positions ───────────────────────────────────────── */
type Tile = { x: number; y: number; z: number; sourceIdx: number };
function makeTiles(): Tile[] {
  const out: Tile[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = TILE_COUNT;
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const y = 1 - t * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    out.push({
      x: x * SPHERE_RADIUS,
      y: y * SPHERE_RADIUS * 0.92,
      z: z * SPHERE_RADIUS,
      sourceIdx: i % SOURCES.length, // distribute across all sources
    });
  }
  return out;
}

/* ─── tiles cloud — yaw on scroll + camera-facing video play/pause ────── */
function TilesSphere({
  scrollOffset,
}: {
  scrollOffset: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const tiles = useMemo(() => makeTiles(), []);
  const bundles = useBundles();
  // Box geometry for thick glass-card feel
  const geometry = useMemo(() => new THREE.BoxGeometry(TILE_W, TILE_H, TILE_DEPTH), []);
  // Edges wireframe for frosted glass border glow
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE_W, TILE_H, TILE_DEPTH)), []);
  const edgeLineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.5 }),
    [],
  );

  const lastCheck = useRef(0);
  const playState = useRef<boolean[]>(SOURCES.map(() => false));
  const tileWorldPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const tileNormalWorld = useRef<THREE.Vector3>(new THREE.Vector3());
  const toCamRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // ── Звук следует за фокусом ──────────────────────────────────────────
  // Лента-логика: ближайшая к камере плитка-видео звучит, остальные молчат.
  // Браузер требует жест пользователя → разблокируем аудио по первому клику.
  const audioUnlocked = useRef(false);
  const focusedVideoIdx = useRef(-1);
  const audioCheck = useRef(0);
  const camPosRef = useRef<THREE.Vector3>(new THREE.Vector3());

  useEffect(() => {
    const unlock = () => { audioUnlocked.current = true; };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ── Глобус: yaw (вокруг мировой Y) + pitch (вокруг мировой X), БЕЗ roll ──
  // Копим два угла из drag и каждый кадр пересобираем ориентацию = pitch*yaw.
  // Без roll → фронтальная карточка всегда строго вертикальна, боковые
  // наклонены перспективой сферы. Pitch ограничиваем, чтобы не кувыркаться.
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const dragYaw = useRef(0);
  const dragPitch = useRef(0);
  const targetQuat = useRef(new THREE.Quaternion());
  const qYawRef = useRef(new THREE.Quaternion());
  const qPitchRef = useRef(new THREE.Quaternion());

  useEffect(() => {
    const applyDrag = (dx: number, dy: number) => {
      dragYaw.current += dx * 0.005;
      dragPitch.current += dy * 0.005;
      // не даём перевернуть шар через полюс (фронт остаётся вертикальным)
      dragPitch.current = Math.max(-1.45, Math.min(1.45, dragPitch.current));
    };
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest("a,button")) return; // не мешаем навигации
      dragging.current = true;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      applyDrag(e.clientX - lastX.current, e.clientY - lastY.current);
      lastX.current = e.clientX;
      lastY.current = e.clientY;
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);


  // Per-tile materials: video on ALL faces, double-sided. Чёрные заглушки — без текстуры.
  const tileMats = useMemo(() => {
    if (!bundles.length) return [];
    return tiles.map((t) => {
      const b = bundles[t.sourceIdx];
      if (b.type === "black") {
        return new THREE.MeshBasicMaterial({
          color: 0x050505,
          toneMapped: false,
          side: THREE.DoubleSide,
        });
      }
      return new THREE.MeshBasicMaterial({
        map: b.texture,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
    });
  }, [bundles, tiles]);

  // Staggered video startup — kick play() on each video with 600ms gap so
  // they don't all hit the network at once. By the time the 8th loads,
  // the first ~5 are already buffered and decoding.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stagger = 0;
    bundles.forEach((b) => {
      if (b.type !== "video") return;
      const delay = stagger;
      stagger += 600;
      timers.push(setTimeout(() => {
        b.video.play().catch(() => {});
      }, delay));
    });
    return () => timers.forEach(clearTimeout);
  }, [bundles]);

  // Надёжность: если вкладка грузилась в фоне (autoplay подавлен) — перезапускаем
  // видео при возврате видимости и по первому жесту, иначе плитки чёрные.
  useEffect(() => {
    const replay = () => {
      if (document.visibilityState !== "visible") return;
      bundles.forEach((b) => {
        if (b.type === "video" && b.video.paused) b.video.play().catch(() => {});
      });
    };
    document.addEventListener("visibilitychange", replay);
    window.addEventListener("pointerdown", replay);
    return () => {
      document.removeEventListener("visibilitychange", replay);
      window.removeEventListener("pointerdown", replay);
    };
  }, [bundles]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (prefersReducedMotion) return;

    // Без авто-вращения: шар стоит, где оставил — можно навести на любую плитку,
    // и она попадёт в фокус (ближайшая к камере звучит). Двигается только от drag.
    // Цель = pitch * yaw (без roll). Боковые карточки наклонены сферой,
    // фронтальная — строго вертикальна. Инерционно подтягиваем ориентацию.
    qYawRef.current.setFromAxisAngle(WORLD_Y, dragYaw.current);
    qPitchRef.current.setFromAxisAngle(WORLD_X, dragPitch.current);
    targetQuat.current.copy(qPitchRef.current).multiply(qYawRef.current);
    groupRef.current.quaternion.slerp(targetQuat.current, Math.min(1, delta * 6));

    // ── Звук следует за фокусом ──────────────────────────────────────────
    // Раз в ~200мс пересчитываем, какое видео ближе всего к камере → оно «в фокусе».
    audioCheck.current += delta;
    if (audioUnlocked.current && audioCheck.current > 0.2) {
      audioCheck.current = 0;
      state.camera.getWorldPosition(camPosRef.current);
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < tiles.length; i++) {
        if (bundles[tiles[i].sourceIdx]?.type !== "video") continue;
        tileWorldPos.current
          .set(tiles[i].x, tiles[i].y, tiles[i].z)
          .applyMatrix4(groupRef.current.matrixWorld);
        const d = tileWorldPos.current.distanceTo(camPosRef.current);
        if (d < bestDist) { bestDist = d; best = tiles[i].sourceIdx; }
      }
      focusedVideoIdx.current = best;
    }

    // Каждый кадр плавно ведём громкость к цели: фокус → 1, остальные → 0.
    for (let i = 0; i < bundles.length; i++) {
      const b = bundles[i];
      if (b.type !== "video") continue;
      const target = audioUnlocked.current && i === focusedVideoIdx.current ? 1 : 0;
      if (target > 0) {
        // фокус: гарантируем, что видео ИГРАЕТ (на паузе звука нет) и распахнуто
        if (b.video.muted) { b.video.muted = false; b.video.volume = 0; }
        if (b.video.paused) b.video.play().catch(() => {});
      }
      // зажимаем в [0,1] — иначе overshoot бросает IndexSizeError и роняет render-loop
      const nv = Math.max(0, Math.min(1, b.video.volume + (target - b.video.volume) * Math.min(1, delta * 4)));
      b.video.volume = nv;
      if (target === 0 && nv < 0.02 && !b.video.muted) b.video.muted = true;
    }
  });

  if (!bundles.length) return null;

  return (
    <group ref={groupRef}>
      {tiles.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]}
          ref={(obj: THREE.Group | null) => {
            // Радиально к центру — карточки лежат на сфере (боковые наклонены
            // перспективой, фронтальная вертикальна, т.к. шар крутится без roll).
            if (obj) obj.lookAt(0, 0, 0);
          }}
        >
          <mesh geometry={geometry} material={tileMats[i]} />
          <lineSegments geometry={edgesGeo} material={edgeLineMat} />
        </group>
      ))}
    </group>
  );
}

/* ─── ASK / ME canvas texture — same recipe as components/BearBrick.tsx ── */
function makeAskMeTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#C9A961";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 8;
  ctx.font = "900 78px Inter, system-ui, sans-serif";
  ctx.fillText("ASK", size / 2, size / 2 - 40);
  ctx.fillText("ME",  size / 2, size / 2 + 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
const _askMeTexture = typeof document !== "undefined" ? makeAskMeTexture() : null;

// Chrome materials — match components/BearBrick.tsx
const _chromeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#E8E8E8"), metalness: 0.95, roughness: 0.15,
});
const _darkMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#0a0a0a"), metalness: 0.2, roughness: 0.3,
});

/* ─── BearBrick in the center — same chubby look as corner mascot ──────── */
function BearBrickCenter() {
  const { scene } = useGLTF("/models/bearbrick.glb.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null!);

  useEffect(() => {
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const name = (child.name ?? "").toLowerCase();
      const isDark = name.includes("body") || name.includes("torso") || name.includes("chest") || name.includes("upper");
      if (isDark) {
        child.material = _darkMat.clone();
      } else {
        // Хром без HDR-окружения: умеренный металл + лёгкий emissive, чтобы
        // мишка бликовал от ламп сцены, а не уходил в чёрное (CDN-Environment
        // флапал в РФ и ронял весь Canvas — убран).
        const m = _chromeMat.clone();
        m.metalness = 0.55;
        m.roughness = 0.18;
        m.emissive = new THREE.Color("#2a2a2a");
        child.material = m;
      }
      child.castShadow = false;
    });
  }, [cloned]);

  // Spring velocity refs for bear rotation (bouncy, alive)
  const bearYawVel = useRef<SpringState>({ velocity: 0 });
  const bearPitchVel = useRef<SpringState>({ velocity: 0 });

  useFrame((state, delta) => {
    if (!ref.current) return;
    if (prefersReducedMotion) return;
    // Look-at-mouse: bear turns toward cursor with bouncy spring
    const targetY = state.mouse.x * 0.7;
    const targetX = -state.mouse.y * 0.35;
    ref.current.rotation.y = springStep(
      ref.current.rotation.y, targetY, bearYawVel.current, 6, 0.85, delta,
    );
    ref.current.rotation.x = springStep(
      ref.current.rotation.x, targetX, bearPitchVel.current, 6, 0.85, delta,
    );
  });

  // Bigger so it dominates the center
  const fitScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return 2.2 / maxDim;
  }, [cloned]);

  return (
    <group ref={ref} scale={fitScale}>
      {/* chubby non-uniform scale just like corner mascot */}
      <primitive object={cloned} scale={[1.15, 0.92, 1.18]} dispose={null} />
      {/* ASK/ME plate on the belly — rotates with bear */}
      {_askMeTexture && (
        <mesh position={[0, -0.35, 0.55]} renderOrder={999}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial
            map={_askMeTexture}
            transparent
            toneMapped={false}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/* ─── hero cinema screen — MD1 (Master Dynamic) hung beside the bear ─────
 * Per the project video methodology: meshBasicMaterial + toneMapped={false},
 * self-lit, front-facing. Tasteful single 16/9 panel, not part of the swirl. */
function CinemaScreen() {
  const ref = useRef<THREE.Mesh>(null!);
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const v = document.createElement("video");
    v.src = R2_VIDEOS.masterDynamic; // R2 URL — referenced, never bundled
    v.crossOrigin = "anonymous";
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.autoplay = false;
    v.preload = "metadata";
    const t = new THREE.VideoTexture(v);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    // gentle delayed start so it doesn't race the tile cloud network-wise
    setTimeout(() => v.play().catch(() => {}), 400);
    return t;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    // soft float so it reads as a floating cinema panel, not UI
    ref.current.position.y =
      1.85 + Math.sin(state.clock.elapsedTime * 0.6) * 0.06;
  });

  if (!texture) return null;
  const W = 3.4;
  const H = W * (9 / 16);
  return (
    <group position={[0, 1.85, 1.6]}>
      <mesh ref={ref}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* thin gold frame — restrained luxury */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[W + 0.07, H + 0.07]} />
        <meshBasicMaterial color="#C9A961" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ─── procedural "deep space" backdrop — cheap canvas texture ──────────── */
function makeSpaceBackdropTexture(): THREE.Texture {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  // Deep purple-blue radial gradient (cosmic, not stage)
  const g = ctx.createRadialGradient(S / 2, S / 2, 50, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, "#1a0d4a");
  g.addColorStop(0.4, "#0a0428");
  g.addColorStop(1, "#02010a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Scatter ~250 stars
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 250; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = Math.random() * 1.4 + 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Few bigger glow points
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const lg = ctx.createRadialGradient(x, y, 0, x, y, 40);
    lg.addColorStop(0, "rgba(180,150,255,0.5)");
    lg.addColorStop(1, "rgba(180,150,255,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, S, S);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function SpaceBackdrop() {
  const tex = useMemo(() => (typeof document !== "undefined" ? makeSpaceBackdropTexture() : null), []);
  if (!tex) return null;
  return (
    <mesh>
      <sphereGeometry args={[30, 24, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

/* ─── soft camera mouse parallax ──────────────────────────────────────── */
function CameraRig() {
  const camXVel = useRef<SpringState>({ velocity: 0 });
  const camYVel = useRef<SpringState>({ velocity: 0 });

  useFrame((state, delta) => {
    if (prefersReducedMotion) {
      state.camera.lookAt(0, 0, 0);
      return;
    }
    state.camera.position.x = springStep(
      state.camera.position.x, state.mouse.x * 0.6,
      camXVel.current, 2.5, 0.92, delta,
    );
    state.camera.position.y = springStep(
      state.camera.position.y, state.mouse.y * 0.3,
      camYVel.current, 2.5, 0.92, delta,
    );
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ─── scene wrapper ───────────────────────────────────────────────────── */
function Scene({ scrollOffset }: { scrollOffset: React.MutableRefObject<number> }) {
  return (
    <>
      <SpaceBackdrop />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 5, 5]} intensity={1.4} color="#fff5dc" />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#88aaff" />
      <BearBrickCenter />
      <TilesSphere scrollOffset={scrollOffset} />
      <CameraRig />
    </>
  );
}

/* ─── exported component ──────────────────────────────────────────────── */
export function TikTokCanvas() {
  const scrollOffset = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const maxScrollPx = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollOffset.current = Math.min(1, Math.max(0, window.scrollY / maxScrollPx));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* spacer to provide real page scroll */}
      <div style={{ height: `${SCROLL_PAGES * 100}vh`, width: "100%", pointerEvents: "none" }} />
      {/* fixed canvas behind content */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <Canvas
          camera={{ position: [0, 0, 9], fov: 42 }}
          dpr={[1, 1.2]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          style={{ background: "#02020a" }}
        >
          <Scene scrollOffset={scrollOffset} />
        </Canvas>
      </div>
    </>
  );
}

useGLTF.preload("/models/bearbrick.glb.glb");
