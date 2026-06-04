"use client";
import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

export function SpotlightTracking() {
  // CSS conic-gradient: 0° = up, 90° = right, 180° = down
  // atan2(y,x): 0° = right → need +90° offset
  // default ~120° = pointing toward lower-right from top-left (screen center direction)
  const rawAngle = useMotionValue(120);
  const springAngle = useSpring(rawAngle, { stiffness: 60, damping: 18 });

  const background = useTransform(
    springAngle,
    (a) =>
      `conic-gradient(from ${a - 12}deg at 0% 0%, transparent, rgba(255, 245, 220, 0.22) 12deg, rgba(255, 245, 220, 0.06) 18deg, transparent 24deg, transparent 360deg)`,
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const deg = Math.atan2(e.clientY, e.clientX) * (180 / Math.PI) + 90;
      rawAngle.set(deg);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [rawAngle]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10"
      style={{ background }}
    />
  );
}
