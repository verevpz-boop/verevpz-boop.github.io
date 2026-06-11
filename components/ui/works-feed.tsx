import Link from "next/link";

/**
 * Лента работ на главной — постеры-ссылки в разделы. Сознательно БЕЗ видео
 * и без 3D: чистые JPG (lazy) грузятся мгновенно даже на слабой мобиле,
 * посетитель видит работы сразу, не кликая в глобус.
 */
const ROWS: {
  title: string;
  href: string;
  tall?: boolean;
  posters: string[];
}[] = [
  {
    title: "Fashion",
    href: "/fashion",
    posters: [
      "/posters/calvin_klein.jpg",
      "/posters/lime.jpg",
      "/posters/demonessa_master.jpg",
    ],
  },
  {
    title: "Cinema",
    href: "/cinema",
    posters: [
      "/posters/reign.jpg",
      "/posters/master_dynamic.jpg",
      "/posters/mishanya_master.jpg",
    ],
  },
  {
    title: "Gaming",
    href: "/gaming",
    posters: [
      "/posters/raid_masterfinal.jpg",
      "/posters/jimeng_warriors.jpg",
      "/posters/smeh_0424.jpg",
    ],
  },
  {
    title: "TikTok",
    href: "/tiktok",
    tall: true,
    posters: [
      "/posters/tiktok/golos.jpg",
      "/posters/tiktok/face_01.jpg",
      "/posters/tiktok/iceland_master.jpg",
    ],
  },
];

export function WorksFeed() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-28 pt-20">
      <h2
        className="text-center"
        style={{
          fontFamily: "var(--font-cormorant)",
          fontStyle: "italic",
          fontSize: "34px",
          fontWeight: 300,
          letterSpacing: "0.25em",
          color: "#C9A961",
        }}
      >
        WORKS
      </h2>
      <p
        className="mt-2 text-center text-[11px] uppercase"
        style={{ letterSpacing: "0.25em", color: "rgba(245,241,232,0.35)" }}
      >
        избранное по направлениям
      </p>

      <div className="mt-14 flex flex-col gap-16">
        {ROWS.map((row) => (
          <div key={row.href}>
            <div className="mb-4 flex items-baseline justify-between">
              <Link
                href={row.href}
                className="transition-colors hover:text-gold"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "26px",
                  fontWeight: 300,
                  letterSpacing: "0.15em",
                  color: "rgba(245,241,232,0.9)",
                }}
              >
                {row.title}
              </Link>
              <Link
                href={row.href}
                className="text-[11px] uppercase transition-colors hover:text-gold"
                style={{ letterSpacing: "0.2em", color: "#C9A961" }}
              >
                смотреть все →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {row.posters.map((p) => (
                <Link
                  key={p}
                  href={row.href}
                  className={`group relative overflow-hidden rounded-lg border border-[#C9A961]/25 bg-black/40 ${
                    row.tall ? "aspect-[9/16] sm:aspect-[3/4]" : "aspect-video"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p}
                    alt={`${row.title} — работа Pavel Zverev`}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full select-none object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-lg ring-0 ring-inset ring-gold/0 transition-all duration-300 group-hover:ring-1 group-hover:ring-gold/60" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
