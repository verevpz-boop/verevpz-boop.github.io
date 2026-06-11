"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/** Все контентные страницы — переход между любыми из них + возврат на главную (логотип). */
const SECTIONS = [
  { label: "Fashion", href: "/fashion" },
  { label: "Tech", href: "/tech" },
  { label: "Cinema", href: "/cinema" },
  { label: "Gaming", href: "/gaming" },
  { label: "AI-Bots", href: "/ai-bots" },
  { label: "TikTok", href: "/tiktok" },
  { label: "Business", href: "/business" }, // Business всегда последним
];

/**
 * Сквозная навигация для всех страниц кроме главной (у неё свой глобус-навигатор).
 * Тонкая полупрозрачная панель сверху: слева вордмарк-логотип (→ домой),
 * справа ссылки на все секции с подсветкой текущей. Сдержанная палитра проекта.
 */
export function SiteNav() {
  const pathname = usePathname();
  // нормализуем хвостовой слэш (trailingSlash:true в next.config)
  const current = pathname.replace(/\/$/, "") || "/";

  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "linear-gradient(180deg, rgba(20,16,11,0.85) 0%, rgba(20,16,11,0) 100%)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:px-6 md:py-4">
        {/* Логотип → главная */}
        <Link
          href="/"
          className="shrink-0 transition-colors active:scale-[0.97]"
          style={{
            fontFamily: "var(--font-cormorant), serif",
            fontStyle: "italic",
            fontSize: "19px",
            letterSpacing: "0.06em",
            color: "rgba(245,241,232,0.92)",
            textDecoration: "none",
          }}
        >
          Pavel Zverev
        </Link>

        {/* Ссылки на секции */}
        <div className="flex items-center gap-x-3 overflow-x-auto md:gap-x-4" style={{ scrollbarWidth: "none" }}>
          {SECTIONS.map((s) => {
            const active = current === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="shrink-0 transition-colors active:scale-[0.97]"
                style={{
                  fontFamily: "var(--font-geist-sans, Inter, sans-serif)",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: active ? "#C9A961" : "rgba(245,241,232,0.5)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
