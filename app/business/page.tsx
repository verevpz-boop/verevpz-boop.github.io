import { BusinessCanvasClient } from "@/components/three/business-canvas-client";

export const metadata = {
  title: "Business Automation — Pavel Zverev",
  description: "AI-автоматизация бизнеса. Робот-рука, монеты, результат.",
};

const SPECS = [
  { label: "Stack", value: "AI + Bots + CRM" },
  { label: "Logic", value: "LLM — Runtime AI" },
  { label: "Uptime", value: "24/7 Auto-Pilot" },
  { label: "Scale", value: "Unlimited Clients" },
];

const TAGS = ["AI/ML", "Bots", "Full-Stack", "Cloud-Ready"];

export default function BusinessPage() {
  return (
    <main className="relative h-screen overflow-hidden text-white" style={{ background: "#07070a" }}>
      <BusinessCanvasClient />

      {/* ── Title block (top-left) ──────────────────────────── */}
      <header
        className="absolute top-0 left-0 px-6 pt-10 md:pt-14 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <div className="max-w-3xl">
          <div
            style={{
              fontFamily: "var(--font-orbitron), var(--font-geist-sans), sans-serif",
              fontWeight: 700,
              fontSize: "clamp(32px, 6.5vw, 72px)",
              letterSpacing: "0.08em",
              lineHeight: 1.0,
              color: "transparent",
              backgroundImage: "linear-gradient(135deg, #E8E8E8 0%, #888888 50%, #C9A961 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
            }}
          >
            AUTOMATION<br />MACHINES&nbsp;·
          </div>
          <p
            className="mt-4 max-w-md"
            style={{
              color: "rgba(255,255,255,0.55)",
              fontFamily: "var(--font-geist-sans), Inter, sans-serif",
              fontWeight: 400,
              fontSize: "15px",
              lineHeight: 1.6,
              letterSpacing: "0.01em",
            }}
          >
            AI-автоматизация бизнес-процессов. Робот работает — вы зарабатываете.
          </p>

          {/* Icon circles */}
          <div className="mt-6 flex gap-3">
            {["⚙", "⟁", "⚡"].map((icon) => (
              <div
                key={icon}
                style={{
                  width: 40, height: 40,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: "rgba(255,255,255,0.5)",
                }}
              >
                {icon}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Technical specs (bottom-left) ──────────────────── */}
      <div
        className="absolute bottom-20 left-6 pointer-events-none"
        style={{ zIndex: 10, maxWidth: 380 }}
      >
        <p
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "11px",
            letterSpacing: "0.25em",
            color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Technical Specs
        </p>
        {SPECS.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Tags (bottom-right) ───────────────────────────── */}
      <div
        className="absolute bottom-20 right-6 flex gap-2 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {TAGS.map((t) => (
          <span
            key={t}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "12px",
              fontFamily: "var(--font-geist-mono), monospace",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.05em",
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* ── CTA button ────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 pointer-events-auto">
        <a
          href="https://t.me/Pavel4417"
          target="_blank"
          rel="noopener"
          className="active:scale-[0.93]"
          style={{
            display: "inline-block",
            padding: "10px 22px",
            borderRadius: "999px",
            background: "linear-gradient(90deg, #C9A961, #8B6914)",
            color: "#0a0a0e",
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: "13px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
            boxShadow:
              "0 8px 32px rgba(201,169,97,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            transition: "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          Заказать @Pavel4417
        </a>
      </div>
    </main>
  );
}
