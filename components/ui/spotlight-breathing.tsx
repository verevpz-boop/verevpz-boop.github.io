"use client";
import { motion } from "motion/react";

export function SpotlightBreathing() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10"
      style={{
        background:
          "conic-gradient(from 305deg at 100% 100%, transparent, rgba(201, 169, 97, 0.28) 9deg, rgba(201, 169, 97, 0.07) 14deg, transparent 20deg, transparent 360deg)",
      }}
      animate={{ opacity: [0.6, 1.0] }}
      transition={{
        duration: 5,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
    />
  );
}
