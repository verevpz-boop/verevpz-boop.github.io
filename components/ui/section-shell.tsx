"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

interface SectionShellProps {
  index: string;
  title: string;
  accent: string;
  tagline: string;
  children: ReactNode;
}

/**
 * Shared luxury shell for the section pages — restrained Vogue aesthetic.
 * Cormorant display title, gold rules, generous negative space. Keeps the
 * same back-to-home affordance the original stubs used.
 */
export function SectionShell({
  index,
  title,
  accent,
  tagline,
  children,
}: SectionShellProps) {
  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F5F1E8]">
      <div className="mx-auto max-w-6xl px-6 pb-32 pt-24 md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <p
            className="mb-5 text-xs uppercase tracking-[0.4em]"
            style={{ color: accent }}
          >
            {index} — {title}
          </p>
          <h1
            className="text-6xl font-light leading-tight md:text-8xl"
            style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic" }}
          >
            {title}
          </h1>
          <div className="mx-auto mt-7 flex max-w-xl items-center justify-center gap-4">
            <span className="h-px w-12 bg-gold/50" />
            <p className="text-sm tracking-[0.2em] text-[#F5F1E8]/55 uppercase">
              {tagline}
            </p>
            <span className="h-px w-12 bg-gold/50" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20"
        >
          {children}
        </motion.div>

        <div className="mt-24 text-center">
          <Link
            href="/"
            className="text-xs tracking-[0.3em] uppercase text-[#F5F1E8]/40 transition-colors hover:text-[#C9A961] active:scale-[0.97] transition-transform"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

interface ShowcaseVideoProps {
  src: string;
  /** "16/9" landscape or "9/16" vertical */
  aspect?: "16/9" | "9/16";
  caption?: string;
  /** Постер (первый кадр) — виден, пока видео грузится: вместо чёрного поля. */
  poster?: string;
}

/** Глобальное событие: один ролик «забирает» звук → остальные глохнут. */
const AUDIO_CLAIM_EVENT = "showcase-audio-claim";

/**
 * R2-referenced video tile. Never downloads — src is always an R2 URL passed
 * in from lib/videos.ts. Автозапуск без звука (политика браузеров). По клику
 * ролик включает звук с плавным fade-in, а любой другой звучавший — глохнет.
 * Звук всегда у одного ролика за раз — галерейная логика, не каша.
 */
export function ShowcaseVideo({
  src,
  aspect = "16/9",
  caption,
  poster,
}: ShowcaseVideoProps) {
  // Вертикальные 9:16 ограничиваем по ширине и центрируем — иначе на всю
  // ширину контейнера они выходят гигантскими. Горизонтальные 16:9 — во всю ширину.
  const isVertical = aspect === "9/16";
  const videoRef = useRef<HTMLVideoElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  const fadeRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(true);
  const id = useId();

  // Играет только то, что на экране: видео за кадром на паузе (экономит CPU и
  // трафик), в зоне видимости — играет. Зацикленное видео не уходит в чёрное.
  useEffect(() => {
    const v = videoRef.current;
    const fig = figureRef.current;
    if (!v || !fig) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(fig);
    return () => io.disconnect();
  }, []);

  // 🔴 При уходе со страницы (размонтировании) — глушим и останавливаем видео,
  // иначе браузер тянет звук и декод старой страницы (музыка «лезет», тормоза).
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
      if (v) {
        try {
          v.pause();
          v.muted = true;
          v.removeAttribute("src");
          v.load();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  /** Плавно меняет громкость от текущей к target за ms. */
  function fadeVolume(target: number, ms: number, onDone?: () => void) {
    const v = videoRef.current;
    if (!v) return;
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const from = v.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // Clamp to [0,1] — float drift (e.g. 1.002) throws IndexSizeError and
      // kills the page. (Same gotcha logged in SITE_DECISIONS for tiktok ramp.)
      v.volume = Math.max(0, Math.min(1, from + (target - from) * t));
      if (t < 1) {
        fadeRef.current = requestAnimationFrame(step);
      } else {
        fadeRef.current = null;
        onDone?.();
      }
    };
    fadeRef.current = requestAnimationFrame(step);
  }

  /** Запустить ролик с начала со звуком; остальные при этом глохнут. */
  function playFromStart() {
    const v = videoRef.current;
    if (!v) return;
    // забрать звук — сказать остальным заглохнуть
    window.dispatchEvent(new CustomEvent(AUDIO_CLAIM_EVENT, { detail: id }));
    v.currentTime = 0; // старт заново по клику
    v.muted = false;
    v.volume = 0;
    v.play().catch(() => {});
    fadeVolume(1, 500);
    setMuted(false);
  }

  /** Заглушить этот ролик (immediate=true — мгновенно, без fade). */
  function muteSelf(immediate = false) {
    const v = videoRef.current;
    if (!v) return;
    if (immediate) {
      if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
      v.volume = 0;
      v.muted = true;
    } else {
      fadeVolume(0, 250, () => {
        if (videoRef.current) videoRef.current.muted = true;
      });
    }
    setMuted(true);
  }

  /** Кнопка-динамик: выкл звук / вкл (с рестартом). */
  function toggleSpeaker() {
    if (muted) playFromStart();
    else muteSelf();
  }

  // слушаем, когда звук забрал другой ролик → ВСЕГДА глохнем (надёжно, без условий)
  useEffect(() => {
    function onClaim(e: Event) {
      const claimedId = (e as CustomEvent<string>).detail;
      if (claimedId !== id) muteSelf();
    }
    window.addEventListener(AUDIO_CLAIM_EVENT, onClaim);
    return () => window.removeEventListener(AUDIO_CLAIM_EVENT, onClaim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <figure
      ref={figureRef}
      onClick={playFromStart}
      className={`group relative cursor-pointer overflow-hidden rounded-sm border border-[#C9A961]/15 bg-black/40 ${
        isVertical ? "mx-auto w-full max-w-[400px]" : "w-full"
      }`}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
        style={{ aspectRatio: aspect }}
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />

      {/* Иконка-динамик — состояние звука, клик тоже переключает */}
      <button
        type="button"
        aria-label={muted ? "Включить звук" : "Выключить звук"}
        onClick={(e) => {
          e.stopPropagation();
          toggleSpeaker();
        }}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-[#F5F1E8] backdrop-blur-sm transition-colors hover:bg-black/70 active:scale-95"
      >
        {muted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>

      {caption && (
        <figcaption className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 text-xs uppercase tracking-[0.25em] text-[#F5F1E8]/70">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
