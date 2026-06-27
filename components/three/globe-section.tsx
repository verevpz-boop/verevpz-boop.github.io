"use client";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { WorksFeed } from "@/components/ui/works-feed";
import { EntryDoors } from "@/components/ui/entry-doors";

const GlobeCanvasDynamic = dynamic(
  () => import("./globe-canvas").then((m) => m.GlobeCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    ),
  },
);

export function GlobeSection() {
  return (
    // 🔴 Главная СКРОЛЛИТСЯ (просьба Pavel'а): глобус — первый экран,
    // ниже обычным скроллом — лента работ (постеры). overflow-hidden
    // остаётся только на hero-секции, не на всей странице.
    <main className="relative w-full bg-background">
      <section className="relative h-screen w-full overflow-hidden">

      {/* ── Top label ───────────────────────────────────────── */}
      <motion.div
        className="pointer-events-none absolute top-10 left-0 right-0 z-20 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <p
          style={{
            fontFamily: "var(--font-cormorant)",
            fontStyle: "italic",
            fontSize: "24px",
            letterSpacing: "0.3em",
            fontWeight: 300,
            color: "#C9A961",
          }}
        >
          NAVIGATE THE WORLDS
        </p>
        <p
          style={{
            marginTop: "6px",
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(245,241,232,0.35)",
            fontFamily: "var(--font-geist-sans, Inter, sans-serif)",
          }}
        >
          click a satellite to explore
        </p>
      </motion.div>

      {/* ── Globe canvas — fills everything ─────────────────── */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlobeCanvasDynamic />
      </motion.div>

      {/* ── Две двери — главная развилка (Работы / Студия) ───────── */}
      <EntryDoors />

      {/* ── Bottom scrim — держит подпись читаемой поверх пролетающих спутников ── */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-28"
        style={{ background: "linear-gradient(to top, rgba(10,8,5,0.9), rgba(10,8,5,0.55) 45%, rgba(10,8,5,0))" }}
      />

      {/* ── Bottom signature ────────────────────────────────── */}
      <motion.div
        className="pointer-events-none absolute bottom-10 left-0 right-0 z-20 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "32px",
            fontWeight: 300,
            letterSpacing: "0.08em",
            color: "rgba(245,241,232,0.9)",
          }}
        >
          Pavel Zverev
        </p>
        <a
          href="https://t.me/Pavel4417"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto transition-colors hover:text-gold active:scale-[0.97] transition-transform"
          style={{
            display: "block",
            marginTop: "6px",
            fontSize: "13px",
            letterSpacing: "0.2em",
            color: "#C9A961",
            fontFamily: "var(--font-geist-sans, Inter, sans-serif)",
            textDecoration: "none",
          }}
        >
          @Pavel4417
        </a>
      </motion.div>

      {/* ── Scroll cue — работы ниже ───────────────────────── */}
      <motion.div
        className="pointer-events-none absolute bottom-2 left-0 right-0 z-20 flex justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.6 }}
      >
        <span className="animate-bounce text-lg" style={{ color: "rgba(201,169,97,0.7)" }}>
          ▾
        </span>
      </motion.div>

      </section>

      {/* ── Лента работ — видна сразу при скролле ──────────── */}
      <WorksFeed />
    </main>
  );
}
