/**
 * Cloudflare R2 — single source of truth for hosted video URLs.
 *
 * ARCHITECTURE CONSTRAINT (Pavel, explicit):
 * The site deploys on a small Aeza VPS. Video must NEVER be bundled into the
 * repo or /public. Always reference these R2 URLs directly inside a
 * <video src=...> tag. This module is the ONLY place R2 URLs may live.
 *
 * Delivery: ПОКА снова напрямую с R2 `*.r2.dev`.
 * ⚠️ 2026-06-06: пробовали Worker-CDN `pavel-cdn.pzverev.workers.dev`, но на
 * РФ-мобайле БЕЗ VPN видео не открывалось вообще — `workers.dev`, видимо,
 * режется ТСПУ. На ПК (под VPN) работало → асимметрия и выдала причину.
 * Worker-код сохранён в `cdn-worker/` для будущего custom-домена (не workers.dev).
 * Source: Pavel's Framer project "Thankful Methodologies".
 */

const R2_BASE = "https://pub-4d3c064541404a1eb448a1c1229e2dfc.r2.dev/";

/** Build an R2 URL, URL-encoding Cyrillic / spaces in the filename. */
function r2(file: string): string {
  return R2_BASE + encodeURIComponent(file);
}

/* ── Root / legacy (Framer website) ─────────────────────────────────────── */
export const R2_VIDEOS = {
  lime: r2("LIME.mp4"),
  masterDynamic: r2("MD1.mp4"),
  veneto: r2("ВЕНЕТТО.mp4"),
  dance: r2("с голосом.mp4"),

  /* ── Fashion ────────────────────────────────────────────────────────── */
  calvinKlein: r2("fashion/calvin_klein_master_v2.mp4"),
  creationPolic4: r2("fashion/creation_polic4.mp4"),
  demonessaMaster: r2("fashion/demonessa_master.mp4"),
  incanto0404: r2("fashion/incanto_0404.mp4"),
  incantoCentr: r2("fashion/incanto_centr.mp4"),
  incantoStudioFashion: r2("fashion/incanto_studio_fashion.mp4"),
  materialWoman: r2("fashion/material-woman.mp4"), // двойное назначение: Fashion + TikTok
  smeh0403: r2("fashion/smeh-0403-3.mp4"),

  /* ── Cinema ─────────────────────────────────────────────────────────── */
  reign: r2("cinema/reign.mp4"),
  mishanyaMaster: r2("cinema/mishanya_master.mp4"),
  jimengTokusatsu: r2("cinema/jimeng_tokusatsu_01.mp4"),
  jimengWarriors: r2("cinema/jimeng_warriors_01.mp4"),
  openartCinema: r2("cinema/openart_cinema_01.mp4"),
  warEpic: r2("cinema/war-epic-0429.mp4"),

  /* ── Gaming ─────────────────────────────────────────────────────────── */
  raidMasterfinal: r2("gaming/raid_masterfinal.mp4"),
  smeh0424gaming: r2("gaming/smeh_0424_2.mp4"),
  jimengWarriorsGaming: r2("gaming/jimeng_warriors_01.mp4"),

  /* ── TikTok (на странице TikTok висит ТОЛЬКО эта категория) ──────────── */
  smeh100: r2("tiktok/smeh_100.mp4"),
  icelandMaster: r2("tiktok/iceland_master.mp4"),
  islandMaster: r2("tiktok/island_master.mp4"),
  smeh0401: r2("tiktok/smeh_0401_2.mp4"),
  smeh0424tiktok: r2("tiktok/smeh_0424_2.mp4"),
  face01: r2("tiktok/face_01.mp4"),
  openartTiktok: r2("tiktok/openart_tiktok_01.mp4"),
  creationPolic4Tiktok: r2("tiktok/creation_polic4.mp4"),
  golos: r2("tiktok/golos.mp4"),
  export0514: r2("tiktok/export-0514-2.mp4"),
  v3: r2("tiktok/v3.mp4"),
  racingSpeeders: r2("tiktok/racing-speeders.mp4"), // «смех→TikTok» (ждёт подтверждения Pavel)
} as const;

export type R2VideoKey = keyof typeof R2_VIDEOS;

/**
 * Слой В (двухфайловая доставка): лёгкое превью 480p ~0.8 Мбит/с лежит на R2
 * под тем же путём с префиксом preview/. Галереи автоплеят превью (пролезает
 * в слабый мобильный канал), полный файл грузится только по клику. Если
 * превью ещё не залито — плеер по onError сам откатывается на полный файл.
 */
export function previewUrl(fullUrl: string): string {
  return fullUrl.replace(R2_BASE, R2_BASE + "preview/");
}

/**
 * Постеры (первый кадр) для видео разделов — лежат в /public/posters.
 * Показываются, пока видео грузится: вместо чёрного поля всегда виден кадр.
 * Мелкие JPG (≈16–140 КБ) — на нагрузку не влияют.
 */
export const POSTERS = {
  calvinKlein: "/posters/calvin_klein.jpg",
  lime: "/posters/lime.jpg",
  demonessaMaster: "/posters/demonessa_master.jpg",
  incanto0404: "/posters/incanto_0404.jpg",
  incantoCentr: "/posters/incanto_centr.jpg",
  creationPolic4: "/posters/creation_polic4.jpg",
  reign: "/posters/reign.jpg",
  masterDynamic: "/posters/master_dynamic.jpg",
  mishanyaMaster: "/posters/mishanya_master.jpg",
  jimengTokusatsu: "/posters/jimeng_tokusatsu.jpg",
  openartCinema: "/posters/openart_cinema.jpg",
  veneto: "/posters/veneto.jpg",
  jimengWarriorsGaming: "/posters/jimeng_warriors.jpg",
  raidMasterfinal: "/posters/raid_masterfinal.jpg",
  smeh0424gaming: "/posters/smeh_0424.jpg",
  materialWoman: "/posters/material_woman.jpg",
  smeh0403: "/posters/smeh_0403.jpg",
  golos: "/posters/golos.jpg",
  export0514: "/posters/export_0514.jpg",
  v3: "/posters/v3.jpg",
  racingSpeeders: "/posters/racing_speeders.jpg",
  warEpic: "/posters/war_epic_0429.jpg",
} as const;
