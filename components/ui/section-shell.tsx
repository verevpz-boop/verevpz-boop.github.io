"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { type ReactNode } from "react";

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
}

/**
 * R2-referenced video tile. Never downloads — src is always an R2 URL passed
 * in from lib/videos.ts. Muted, looped, autoplay, playsInline (no audio per
 * the project video methodology).
 */
export function ShowcaseVideo({
  src,
  aspect = "16/9",
  caption,
}: ShowcaseVideoProps) {
  return (
    <figure className="group relative overflow-hidden rounded-sm border border-[#C9A961]/15 bg-black/40">
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
        style={{ aspectRatio: aspect }}
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
      {caption && (
        <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 text-xs uppercase tracking-[0.25em] text-[#F5F1E8]/70">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
