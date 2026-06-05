/**
 * Cloudflare R2 — single source of truth for hosted video URLs.
 *
 * ARCHITECTURE CONSTRAINT (Pavel, explicit):
 * The site deploys on a small Aeza VPS. Video must NEVER be bundled into the
 * repo or /public. Always reference these R2 URLs directly inside a
 * <video src=...> tag. This module is the ONLY place R2 URLs may live.
 *
 * Base bucket: https://pub-4d3c064541404a1eb448a1c1229e2dfc.r2.dev/
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

  /* ── Cinema ─────────────────────────────────────────────────────────── */
  reign: r2("cinema/reign.mp4"),
  mishanyaMaster: r2("cinema/mishanya_master.mp4"),
  jimengTokusatsu: r2("cinema/jimeng_tokusatsu_01.mp4"),
  jimengWarriors: r2("cinema/jimeng_warriors_01.mp4"),
  openartCinema: r2("cinema/openart_cinema_01.mp4"),

  /* ── Gaming ─────────────────────────────────────────────────────────── */
  raidMasterfinal: r2("gaming/raid_masterfinal.mp4"),
  smeh0424gaming: r2("gaming/smeh_0424_2.mp4"),
  jimengWarriorsGaming: r2("gaming/jimeng_warriors_01.mp4"),

  /* ── TikTok ─────────────────────────────────────────────────────────── */
  smeh100: r2("tiktok/smeh_100.mp4"),
  icelandMaster: r2("tiktok/iceland_master.mp4"),
  smeh0401: r2("tiktok/smeh_0401_2.mp4"),
  smeh0424tiktok: r2("tiktok/smeh_0424_2.mp4"),
  face01: r2("tiktok/face_01.mp4"),
  openartTiktok: r2("tiktok/openart_tiktok_01.mp4"),
  creationPolic4Tiktok: r2("tiktok/creation_polic4.mp4"),
} as const;

export type R2VideoKey = keyof typeof R2_VIDEOS;

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
} as const;
