"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BearBrickChat } from "@/components/BearBrickChat";

/* Пока 3D-чанк едет по сети, держим на месте тот же бейдж — мишка не мигает. */
const badgeImg = (
  <img
    src="/bearbrick-badge.webp"
    alt="AI-помощник — нажми и спроси"
    loading="lazy"
    className="w-[110px] md:w-[170px] select-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
    draggable={false}
  />
);

const BearBrickCanvas = dynamic(
  () => import("@/components/BearBrick").then((m) => m.BearBrick),
  { ssr: false, loading: () => badgeImg },
);

/**
 * Маскот: ТОЛЬКО десктоп (решение Pavel'а 2026-06-11 — на мобиле уродливо,
 * убран совсем; вместе с ним на мобиле нет и входа в чат). На десктопе сперва
 * лёгкий WebP-бейдж (5 КБ), 3D (GLB 2.3 МБ + R3F-canvas) монтируется когда
 * браузер простаивает — мишка не конкурирует с контентом за канал и GPU.
 */
export function BearBrickClient() {
  const [chatOpen, setChatOpen] = useState(false);
  const [mount3d, setMount3d] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 1024) return; // мобила: остаёмся на картинке
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(() => setMount3d(true), { timeout: 6000 })
      : window.setTimeout(() => setMount3d(true), 3500);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);

  return (
    <>
      <div
        className="fixed bottom-8 right-8 z-30 hidden cursor-pointer lg:block"
        onClick={() => setChatOpen((s) => !s)}
      >
        {mount3d ? <BearBrickCanvas /> : badgeImg}
      </div>
      <BearBrickChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
