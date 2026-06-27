import Link from "next/link";

export const metadata = {
  title: "Студия — Pavel Zverev",
  description: "Что я делаю: AI-боты, бизнес-автоматизация, 3D-сайты, Instagram-автопостинг.",
};

const MAIN: { label: string; href: string; desc: string }[] = [
  { label: "AI-боты · Джарви", href: "/ai-bots", desc: "n8n-автоматизация и говорящие ассистенты" },
  { label: "Бизнес-автоматизация", href: "/business", desc: "робот-рука хватает деньги — процессы на автопилоте" },
  { label: "3D-сайты", href: "/web3d", desc: "Awwwards-tier, React Three Fiber, живые сцены" },
  { label: "Instagram-автопостинг", href: "/instagram", desc: "контент выходит сам, по расписанию" },
];

const SUB: { label: string; href: string }[] = [
  { label: "VPN", href: "/vpn" },
  { label: "Вектор-память", href: "/vector-memory" },
  { label: "AI-аватар", href: "/avatar" },
];

export default function StudioPage() {
  return (
    <main className="min-h-screen bg-background px-6 pb-28 pt-28 text-foreground">
      <header className="mx-auto max-w-6xl text-center">
        <p className="text-[11px] uppercase" style={{ letterSpacing: "0.3em", color: "rgba(201,169,97,0.7)" }}>
          02 — что я делаю
        </p>
        <h1
          style={{
            marginTop: 10,
            fontFamily: "var(--font-cormorant), serif",
            fontWeight: 300,
            fontSize: "clamp(48px, 9vw, 96px)",
            letterSpacing: "0.06em",
            color: "rgba(245,241,232,0.95)",
          }}
        >
          Студия
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "rgba(245,241,232,0.5)" }}>
          AI-инструменты под бизнес. Выбери услугу.
        </p>
      </header>

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
        {MAIN.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group relative overflow-hidden rounded-xl border border-[#C9A961]/25 bg-black/30 p-6 transition-colors hover:border-[#C9A961]/55"
          >
            <span
              style={{
                fontFamily: "var(--font-cormorant), serif",
                fontSize: "26px",
                fontWeight: 400,
                letterSpacing: "0.06em",
                color: "rgba(245,241,232,0.95)",
              }}
            >
              {s.label}
            </span>
            <p className="mt-2 text-sm" style={{ color: "rgba(245,241,232,0.55)", lineHeight: 1.5 }}>
              {s.desc}
            </p>
            <span className="mt-4 inline-block text-[11px] uppercase transition-colors group-hover:text-gold" style={{ letterSpacing: "0.2em", color: "rgba(201,169,97,0.75)" }}>
              открыть →
            </span>
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-3">
        <span className="text-[11px] uppercase" style={{ letterSpacing: "0.2em", color: "rgba(245,241,232,0.35)" }}>
          ещё:
        </span>
        {SUB.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-full border border-[#C9A961]/20 px-4 py-1.5 text-xs transition-colors hover:border-[#C9A961]/50 hover:text-gold"
            style={{ letterSpacing: "0.08em", color: "rgba(245,241,232,0.6)" }}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link href="/" className="text-[11px] uppercase transition-colors hover:text-gold" style={{ letterSpacing: "0.2em", color: "rgba(245,241,232,0.45)" }}>
          ← на главную
        </Link>
      </div>
    </main>
  );
}
