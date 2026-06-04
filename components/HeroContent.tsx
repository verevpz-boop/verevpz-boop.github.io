"use client";
import { motion } from "motion/react";
import { MagneticLink } from "@/components/ui/magnetic-link";

const SECTIONS = ["Fashion", "Tech", "Cinema", "Gaming", "AI-Bots"];

const NAME = "Pavel Zverev";

export function HeroContent() {
  return (
    <>
      {/* 1 — PORTFOLIO 2026: fade + letter-spacing collapse */}
      <motion.p
        className="mb-6 text-xs uppercase text-foreground/50"
        style={{ letterSpacing: "0.5em", willChange: "letter-spacing, opacity" }}
        initial={{ opacity: 0, letterSpacing: "0.7em" }}
        animate={{ opacity: 1, letterSpacing: "0.4em" }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0 }}
      >
        {/* Conscious exception: letterSpacing animation retained for visual fidelity.
            scaleX cannot replicate per-glyph spacing collapse. will-change hints
            the browser to promote this element to its own compositor layer. */}
        Portfolio · 2026
      </motion.p>

      {/* 2 — Pavel Zverev: буква за буквой снизу */}
      <h1 className="font-[family-name:var(--font-display)] text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl md:text-8xl">
        {NAME.split("").map((char, i) => (
          <motion.span
            key={i}
            style={{ display: "inline-block" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.8 + i * 0.05,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {char === " " ? " " : char}
          </motion.span>
        ))}
      </h1>

      {/* 3 — разделители + AI-Creator: fade + scale */}
      <motion.div
        className="mt-6 flex items-center gap-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 1.55, ease: "easeOut" }}
      >
        <span className="h-px w-12 bg-gold/60" />
        <span className="font-[family-name:var(--font-display)] text-lg italic text-gold sm:text-xl">
          AI-Creator
        </span>
        <span className="h-px w-12 bg-gold/60" />
      </motion.div>

      {/* 4 — разделы с магнитным эффектом: fade + y */}
      <motion.div
        className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm sm:text-base"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 2.1, ease: "easeOut" }}
      >
        {SECTIONS.map((section, i) => (
          <span key={section} className="flex items-center gap-x-2">
            <MagneticLink>{section}</MagneticLink>
            {i < SECTIONS.length - 1 && (
              <span className="text-foreground/30 select-none">·</span>
            )}
          </span>
        ))}
      </motion.div>
    </>
  );
}

export function HeroFooter() {
  return (
    <motion.footer
      className="w-full pb-10 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 2.7, ease: "easeOut" }}
    >
      <a
        href="https://t.me/Pavel4417"
        target="_blank"
        rel="noreferrer"
        className="text-sm tracking-[0.2em] text-foreground/70 transition-colors hover:text-gold active:scale-[0.97] transition-transform"
      >
        @Pavel4417
      </a>
    </motion.footer>
  );
}
