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
  streetFight: r2("cinema/streetfight_01.mp4"),
  battle: r2("cinema/battle_01.mp4"),
  lumiere: r2("cinema/lumiere_01.mp4"),
  // 2026-10-19 — новые мастера (ревизия Pavel'а)
  halloween: r2("cinema/halloween_01.mp4"),
  samuraiS2: r2("cinema/samurai_s2_01.mp4"),
  samuraiS3: r2("cinema/samurai_s3_01.mp4"),
  angel: r2("cinema/angel_01.mp4"),
  bedroomFight: r2("cinema/bedroom_fight_01.mp4"),
  cosmicBattle: r2("cinema/cosmic_battle_01.mp4"),
  hedjSiroi: r2("cinema/hedj_siroi_01.mp4"),
  hedjSkali: r2("cinema/hedj_skali_01.mp4"),
  starmoyHorror: r2("cinema/starmoy_horror_01.mp4"),
  soskuchilsya: r2("cinema/soskuchilsya_01.mp4"),
  crowd: r2("cinema/crowd_01.mp4"),
  chas: r2("cinema/chas_01.mp4"),

  /* ── Animation (AI-мультсериал «Шифу Учит», вертикаль 9:16) ───────────── */
  animMuha: r2("animation/muha_01.mp4"),
  animKungfu: r2("animation/kungfu_01.mp4"),
  animTianxia: r2("animation/tianxia_01.mp4"),
  animDrakon: r2("animation/drakon_01.mp4"),
  animBaoen: r2("animation/baoen_01.mp4"),
  animHeng: r2("animation/heng_01.mp4"),
  animMing: r2("animation/ming_01.mp4"),
  animShifu08: r2("animation/shifu_08_01.mp4"),
  animShifu09: r2("animation/shifu_09_01.mp4"),
  animOtter: r2("animation/otter_01.mp4"),
  animKungfuSchool: r2("animation/kungfu_school_01.mp4"),
  animMapSamurai: r2("animation/map_samurai_01.mp4"),

  /* ── Gaming ─────────────────────────────────────────────────────────── */
  raidMasterfinal: r2("gaming/raid_masterfinal.mp4"),
  smeh0424gaming: r2("gaming/smeh_0424_2.mp4"),
  jimengWarriorsGaming: r2("gaming/jimeng_warriors_01.mp4"),
  orki01: r2("gaming/orki_01_01.mp4"),
  orki02: r2("gaming/orki_02_01.mp4"),
  orki03: r2("gaming/orki_03_01.mp4"),
  orki04: r2("gaming/orki_04_01.mp4"),
  raidWaterfall: r2("gaming/raid_waterfall_01.mp4"),
  raidDuel: r2("gaming/raid_duel_01.mp4"),

  /* ── Fashion (2026-10-19) ───────────────────────────────────────────── */
  cloudCat: r2("fashion/cloud_cat_01.mp4"),

  /* ── Tech ───────────────────────────────────────────────────────────── */
  maldivesHotel: r2("tech/maldives_hotel_01.mp4"),
  ferrari: r2("tech/ferrari_01.mp4"),
  driver4k: r2("tech/driver_4k_01.mp4"),
  girlRobot: r2("tech/girl_robot_01.mp4"),
  skoraya60p: r2("tech/skoraya_60p_01.mp4"),

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
  nakedSamurai: r2("tiktok/naked_samurai_01.mp4"),
  tusiTusi: r2("tiktok/tusi_tusi_01.mp4"),
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
  maldivesHotel: "/posters/maldives_hotel.jpg",
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
  streetFight: "/posters/streetfight.jpg",
  battle: "/posters/battle.jpg",
  lumiere: "/posters/lumiere.jpg",
  animMuha: "/posters/animation/muha.jpg",
  animKungfu: "/posters/animation/kungfu.jpg",
  animTianxia: "/posters/animation/tianxia.jpg",
  animDrakon: "/posters/animation/drakon.jpg",
  animBaoen: "/posters/animation/baoen.jpg",
  animHeng: "/posters/animation/heng.jpg",
  animMing: "/posters/animation/ming.jpg",
  // 2026-10-19 — новые мастера
  halloween: "/posters/halloween.jpg",
  samuraiS2: "/posters/samurai_s2.jpg",
  samuraiS3: "/posters/samurai_s3.jpg",
  angel: "/posters/angel.jpg",
  bedroomFight: "/posters/bedroom_fight.jpg",
  cosmicBattle: "/posters/cosmic_battle.jpg",
  hedjSiroi: "/posters/hedj_siroi.jpg",
  hedjSkali: "/posters/hedj_skali.jpg",
  starmoyHorror: "/posters/starmoy_horror.jpg",
  soskuchilsya: "/posters/soskuchilsya.jpg",
  crowd: "/posters/crowd.jpg",
  chas: "/posters/chas.jpg",
  orki01: "/posters/orki_01.jpg",
  orki02: "/posters/orki_02.jpg",
  orki03: "/posters/orki_03.jpg",
  orki04: "/posters/orki_04.jpg",
  raidWaterfall: "/posters/raid_waterfall.jpg",
  raidDuel: "/posters/raid_duel.jpg",
  cloudCat: "/posters/cloud_cat.jpg",
  ferrari: "/posters/ferrari.jpg",
  driver4k: "/posters/driver_4k.jpg",
  girlRobot: "/posters/girl_robot.jpg",
  skoraya60p: "/posters/skoraya_60p.jpg",
  animShifu08: "/posters/animation/shifu_08.jpg",
  animShifu09: "/posters/animation/shifu_09.jpg",
  animOtter: "/posters/animation/otter.jpg",
  animKungfuSchool: "/posters/animation/kungfu_school.jpg",
  animMapSamurai: "/posters/animation/map_samurai.jpg",
} as const;
