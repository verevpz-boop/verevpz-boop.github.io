import Link from "next/link";

export const metadata = {
  title: "Работы — Pavel Zverev",
  description: "Шоурил AI-видео: кино, фэшн, гейминг, тех, тикток.",
};

const ITEMS: { label: string; href: string; poster: string; tall?: boolean }[] = [
  { label: "Fashion", href: "/fashion", poster: "/posters/calvin_klein.jpg" },
  { label: "Cinema", href: "/cinema", poster: "/posters/reign.jpg" },
  { label: "Gaming", href: "/gaming", poster: "/posters/raid_masterfinal.jpg" },
  { label: "Tech", href: "/tech", poster: "/posters/maldives_hotel.jpg" },
  { label: "TikTok", href: "/tiktok", poster: "/posters/tiktok/golos.jpg", tall: true },
];

export default function WorkPage() {
  return (
    <main className="min-h-screen bg-background px-6 pb-28 pt-28 text-foreground">
      <header className="mx-auto max-w-6xl text-center">
        <p className="text-[11px] uppercase" style={{ letterSpacing: "0.3em", color: "rgba(201,169,97,0.7)" }}>
          01 — шоурил
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
          Работы
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: "rgba(245,241,232,0.5)" }}>
          AI-видео по направлениям. Выбери мир.
        </p>
      </header>

      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`group relative overflow-hidden rounded-xl border border-[#C9A961]/25 bg-black/40 ${
              it.tall ? "aspect-[3/4]" : "aspect-video"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.poster}
              alt={`${it.label} — работы Pavel Zverev`}
              loading="lazy"
              draggable={false}
              className="h-full w-full select-none object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
            <div className="absolute bottom-0 left-0 p-5">
              <span
                style={{
                  fontFamily: "var(--font-cormorant), serif",
                  fontSize: "26px",
                  fontWeight: 400,
                  letterSpacing: "0.12em",
                  color: "rgba(245,241,232,0.95)",
                }}
              >
                {it.label}
              </span>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-0 ring-inset ring-gold/0 transition-all duration-300 group-hover:ring-1 group-hover:ring-gold/60" />
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
