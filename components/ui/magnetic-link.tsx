"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import Link from "next/link";

interface MagneticLinkProps {
  children: React.ReactNode;
  className?: string;
  radius?: number;
  maxShift?: number;
  href?: string;
}

export function MagneticLink({
  children,
  className,
  radius = 60,
  maxShift = 9,
  href,
}: MagneticLinkProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 250, damping: 22 });
  const y = useSpring(rawY, { stiffness: 250, damping: 22 });

  useEffect(() => {
    // disable on touch-only devices
    if (window.matchMedia("(hover: none)").matches) return;

    const onMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        rawX.set((dx / radius) * maxShift);
        rawY.set((dy / radius) * maxShift);
        setActive(true);
      } else {
        rawX.set(0);
        rawY.set(0);
        setActive(false);
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [rawX, rawY, radius, maxShift]);

  const inner = (
    <motion.span
      ref={ref}
      style={{ x, y }}
      className={[
        "inline-block cursor-pointer select-none",
        "transition-colors duration-200",
        active ? "text-gold" : "text-foreground/60",
        "active:text-gold active:scale-[0.97] transition-transform",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </motion.span>
  );

  if (href) {
    return <Link href={href} className="no-underline">{inner}</Link>;
  }
  return inner;
}
