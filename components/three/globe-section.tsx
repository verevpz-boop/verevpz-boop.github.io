"use client";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { MagneticLink } from "@/components/ui/magnetic-link";

const SECTIONS = [
  { label: "Fashion", href: "/fashion" },
  { label: "Tech",    href: "/tech"    },
  { label: "Cinema",  href: "/cinema"  },
  { label: "Gaming",  href: "/gaming"  },
  { label: "AI-Bots", href: "/ai-bots" },
  { label: "TikTok",  href: "/tiktok"  },
  { label: "Business", href: "/business" }, // Business всегда последним
];

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
    <main className="relative h-screen w-full overflow-hidden bg-[#0A0A0A]">

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

      {/* ── Text navigation ─────────────────────────────────── */}
      <motion.div
        className="pointer-events-auto absolute bottom-28 left-0 right-0 z-20 flex items-center justify-center gap-x-3 text-sm sm:text-base"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0 }}
        style={{ letterSpacing: "0.15em" }}
      >
        {SECTIONS.map((s, i) => (
          <span key={s.href} className="flex items-center gap-x-3">
            <MagneticLink href={s.href} radius={50} maxShift={8}>
              {s.label}
            </MagneticLink>
            {i < SECTIONS.length - 1 && (
              <span style={{ color: "rgba(255,255,255,0.3)", userSelect: "none" }}>·</span>
            )}
          </span>
        ))}
      </motion.div>

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

    </main>
  );
}
