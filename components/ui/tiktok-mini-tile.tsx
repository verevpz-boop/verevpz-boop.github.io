"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

/**
 * Плитка TikTok: мини-мишка-сфера (3D), клик → /tiktok (большой мишка + клипы).
 *
 * 🔴 Канвас монтируем ТОЛЬКО когда плитка попала в зону видимости
 * (IntersectionObserver). Иначе в ленте главной (плитка глубоко внизу длинной
 * страницы) WebGL инициализируется за кадром и не получает кадров → мишка чёрный.
 * Маунт-по-видимости = сцена стартует уже на экране и рисуется. Заодно не плодит
 * лишний живой контекст, пока до неё не доскроллили.
 */
const TikTokMiniCanvas = dynamic(
  () => import("@/components/three/tiktok-mini").then((m) => m.TikTokMini),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    ),
  },
);

export function TikTokMiniTile() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Link
      ref={ref}
      href="/tiktok"
      aria-label="TikTok — вертикальные шортсы"
      className="group relative block aspect-video overflow-hidden rounded-lg border border-[#C9A961]/25 bg-black/40"
    >
      <div className="absolute inset-0">
        {inView ? (
          <TikTokMiniCanvas />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-black/0" />
      <div className="pointer-events-none absolute bottom-0 left-0 p-4">
        <span
          style={{
            fontFamily: "var(--font-cormorant), serif",
            fontSize: "24px",
            fontWeight: 400,
            letterSpacing: "0.12em",
            color: "rgba(245,241,232,0.95)",
          }}
        >
          TikTok
        </span>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-lg ring-0 ring-inset ring-gold/0 transition-all duration-300 group-hover:ring-1 group-hover:ring-gold/60" />
    </Link>
  );
}
