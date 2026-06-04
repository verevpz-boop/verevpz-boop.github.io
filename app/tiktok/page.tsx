import { TikTokCanvasClient } from "@/components/three/tiktok-canvas-client";

export const metadata = {
  title: "TikTok — Pavel Zverev",
  description: "Vertical short-form video portfolio",
};

export default function TikTokPage() {
  return (
    <main className="relative text-white" style={{ background: "#0a0a12" }}>
      <TikTokCanvasClient />

      {/* Top header — over the 3D canvas */}
      <header className="relative px-6 pt-10 md:pt-16 pointer-events-none" style={{ zIndex: 10 }}>
        <div className="max-w-3xl">
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(40px, 8vw, 96px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              background:
                "linear-gradient(90deg, #ff0050 0%, #ff4081 40%, #00f2ea 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "0 0 28px rgba(255, 0, 80, 0.25)",
              willChange: "transform",
            }}
          >
            TIKTOK
          </div>
          <div
            className="mt-3 text-base md:text-lg max-w-xl"
            style={{
              color: "rgba(255,255,255,0.75)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              letterSpacing: "0.01em",
            }}
          >
            Вертикальные 9:16. Танцы, юмор, трендовые форматы. Скроль —
            пластины движутся сквозь сцену.
          </div>
        </div>
      </header>

      {/* Bottom CTA — sticky */}
      <div
        className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 pointer-events-auto"
      >
        <a
          href="https://t.me/Pavel4417"
          target="_blank"
          rel="noopener"
          className="active:scale-[0.93]"
          style={{
            display: "inline-block",
            padding: "10px 22px",
            borderRadius: "999px",
            background: "linear-gradient(90deg, #ff0050, #7e1fff)",
            color: "white",
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: "13px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
            boxShadow: "0 8px 32px rgba(255, 0, 80, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            transition: "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          Заказать @Pavel4417
        </a>
      </div>
    </main>
  );
}
