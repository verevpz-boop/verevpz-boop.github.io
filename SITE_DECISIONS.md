# Pavel-Site — Решения и грабли (читать ПЕРВЫМ)

> Канонический журнал решений по сайту. Веду я (Claude) для себя же и будущих сессий,
> чтобы не ходить одними путями по кругу. Обновлять при каждом значимом изменении.
> Последнее обновление: 2026-06-05.

---

## 🚀 Деплой
- **🔴 ПРАВИЛО (standing, Pavel 2026-06-05): закончил ЛЮБЫЕ правки сайта → СРАЗУ сам публикую** — `git add` + `commit` + `push` в `master`. Не ждать отдельной просьбы, не спрашивать «пушить?». Push = авто-деплой на Pages. Это часть «готово» по любой задаче сайта.
- **Живой URL:** https://verevpz-boop.github.io/ — это **user-сайт** (репо `verevpz-boop.github.io`), обслуживается из корня → **basePath НЕ нужен**.
- **Репо:** https://github.com/verevpz-boop/verevpz-boop.github.io (публичный).
- **Аккаунт GitHub:** `verevpz-boop` (Google OAuth verevpz@gmail.com). `gh` CLI v2.93.0 авторизован. Детали — `КЛЮЧИ_И_ДОСТУПЫ.md`.
- **Авто-деплой:** push в `master` → GitHub Actions (`.github/workflows`) собирает `output:"export"` → Pages. ~1–2 мин.
- **Как деплоить:** правка → `git add` → `git commit` → `git push`. Всё.

## ⚠️ Грабли сборки (Windows)
- `npx next build` падает на финале с `EBUSY: rmdir 'out'`, если висит dev-сервер или прошлый процесс держит `out/`. **Компиляция при этом проходит** (видно `✓ Compiled successfully`). На Ubuntu-Actions этой ошибки НЕТ — пуш собирается чисто. Локально для проверки TS достаточно увидеть `✓ Compiled`. При нужде: `taskkill /F /IM node.exe` + `rm -rf out`.

---

## 🎬 R2 — видеохранилище
- **Бакет:** `video`, account `4e502301953c3bae312a35efb40d3739`.
- **Публичный базовый URL:** `https://pub-4d3c064541404a1eb448a1c1229e2dfc.r2.dev/`
- **Токен:** `CLOUDFLARE_API_TOKEN` = `cfut_...` (в `КЛЮЧИ_И_ДОСТУПЫ.md`).
- **🔴 wrangler put ВСЕГДА с `--remote`** — без него льёт в локальную эмуляцию, не на боевой R2. `$env:CLOUDFLARE_API_TOKEN=...; npx wrangler r2 object put "video/<key>" --file=... --content-type="video/mp4" --remote`
- **Категории (папки):** `fashion/ cinema/ gaming/ tiktok/ avatars/ art/ reels/` + корневые файлы сайта (LIME.mp4, MD1.mp4, ВЕНЕТТО.mp4, «с голосом.mp4»).
- **Список объектов:** через Cloudflare API (`/r2/buckets/video/objects`) с пагинацией по cursor; `wrangler r2 object list` в v4 НЕ существует.

## 🔴🔴 КОДЕК — только H.264
Chrome/Firefox **НЕ играют H.265/HEVC** в HTML5-видео → **чёрный экран** (на страницах и в TikTok-текстуре). Safari играет — потому легко проглядеть.
**ПЕРЕД заливкой проверять:** `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 <url|file>`
Если `hevc` — перекодировать:
```
ffmpeg -i in.mp4 -vf "scale='min(1080,iw)':-2" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 21 -preset fast -c:a aac -b:a 128k -movflags +faststart out.mp4
```
(4K жмём до 1080 для веба; `+faststart` = moov в начало). История: 2026-06-05 поймали 7 файлов в HEVC, перекодировали.

## 🔴 CORS на R2 — обязателен для TikTok
Летающие плитки TikTok рендерят видео как **WebGL-текстуры** (`crossOrigin="anonymous"`) — без CORS-заголовков они чёрные/висят. Обычные `<video>` на страницах разделов CORS НЕ требуют.
CORS выставлен на бакет `video` (origin `https://verevpz-boop.github.io` + localhost). Файл `r2-cors.json` (gitignored). Команда: `wrangler r2 bucket cors set video --file r2-cors.json --force`. **При смене домена — обновить origins.**

## ffprobe / ffmpeg
Путь: `C:\Users\ИИ Павел\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-*-full_build\bin\` (есть и ffmpeg.exe, и ffprobe.exe).

---

## 🎥 Видео на сайте — аспекты, постеры, плеер
- **Источник истины:** `lib/videos.ts` — `R2_VIDEOS` (URL) + `POSTERS` (первый кадр). URL НИКОГДА не хардкодить в компонентах.
- **Аспекты:** `ShowcaseVideo` принимает `aspect="16/9"` | `"9/16"`. **Перед привязкой проверять реальные размеры ffprobe** — вертикальные (1080×1920) → `9/16` (центрируются, max-width 400px), горизонтальные → `16/9`. Иначе `object-cover` кропает.
- **Постеры (нет чёрного):** первый кадр как JPG в `/public/posters/<name>.jpg` (16–140 КБ). Виден, пока видео грузится. Генерить: `ffmpeg -ss 0.5 -i <url> -frames:v 1 -q:v 4 -vf "scale='min(720,iw)':-2" out.jpg`.
- **Играет только видимое:** `ShowcaseVideo` через IntersectionObserver play()/pause() — за кадром пауза (экономит CPU/трафик). Видео на `loop` — до чёрного конца не доходит.

## 🔊 Звук — две разные логики
- **Разделы (Fashion/Cinema/Gaming) — галерея:** автозапуск без звука. **Клик по клипу → старт с начала + звук fade-in 500мс, все остальные ГЛОХНУТ** (window-событие `showcase-audio-claim`, обработчик глушит ВСЕГДА без условий). Иконка-динамик в углу = вкл/выкл без рестарта. Один звук за раз.
- **TikTok — лента:** ближайшая к камере плитка звучит, остальные молчат; громкость ведётся к цели каждый кадр. Аудио разблокируется первым жестом (`pointerdown/touchstart/keydown`).
- **🔴 Грабля:** ramp громкости ОБЯЗАН быть зажат `Math.max(0,Math.min(1,...))` — overshoot за [0,1] бросает `IndexSizeError` каждый кадр и роняет WebGL (Context Lost → сфера чёрная). Уже зажато в обоих местах.

## 🌀 TikTok — сфера
- **Только клипы + чёрные заглушки.** Статичных фото НЕТ (убраны). `SPHERE_TILES=30`: видео + чёрные плитки на пустых слотах (Pavel доввесит). Источники: `_videos` в `tiktok-canvas.tsx`.
- **Вращение — кватернионный трекбол (НЕ Euler!).** Drag вращает вокруг МИРОВЫХ осей через `premultiply` (`WORLD_X`/`WORLD_Y`) → честное кувыркание во все стороны, без gimbal-lock и «блина по часовой». Euler-углы давали плоский поворот — НЕ возвращать к ним. **Авто-вращения НЕТ** — шар стоит, где оставил (чтобы навести на плитку → она в фокусе → звучит).
- **🔴 НЕ использовать `<Environment preset="..."/>` из drei** — грузит HDR с внешнего CDN (pmndrs); в РФ флапает/блокируется, при ошибке загрузчика **рушит весь R3F-Canvas в чёрноту БЕЗ ошибки в консоли** (видны только THREE.Clock warnings — значит loop жив, но не презентует). Поймали 2026-06-05. Хром мишки делаем настройкой материала: `metalness 0.55, roughness 0.18, emissive #2a2a2a` + лампы сцены — без внешних зависимостей.
- **Видео-плитки: перезапуск по visibilitychange/жесту.** Если вкладка грузилась в фоне, autoplay-стартап подавлен → плитки чёрные. Replay-обработчик в `TilesSphere` оживляет их при возврате видимости/первом клике. (В скрытой авто-вкладке тест-инструмента видео всё равно не прорисуются — это артефакт фон-троттлинга, у реального юзера ок.)
- **Плитки — БИЛБОРД (строго вертикально).** Каждая плитка каждый кадр `lookAt(camera)` с мировым up → шар крутит только их ПОЗИЦИИ, сами плитки не заваливаются/не кренятся. `tileRefs` + `groupRef.updateMatrixWorld(true)` перед билбордом. НЕ возвращать к одноразовому `lookAt(0,0,0)` (давал крен при наклоне шара).
- **Звук фокуса: сфокусированное видео нужно ещё и `play()`.** Просто unmute паузного видео = тишина. В ramp при target>0 вызываем `b.video.play()`. Аудио-разблокировка — по жесту (drag=pointerdown годится).

## 🐻 Чат мишки (BearBrickChat)
- **Мост `http://localhost:5680/bearbrick` мёртв на проде** — доступен только на машине Pavel'а, блокируется как mixed-content на HTTPS. Решение: 4с AbortController-таймаут + клиентский FAQ `localAnswer()` (заготовки про разделы, заказы → @Pavel4417). Локально dev может звать реальный мост.
- Для живого LLM-чата на проде нужен **публичный Cloudflare Worker** (ключи НЕ в клиент!).

## 🧭 Навигация
- **Business — ВСЕГДА последним.** Порядок: Fashion · Tech · Cinema · Gaming · AI-Bots · TikTok · Business. В двух местах: `components/ui/site-nav.tsx` (верх) и `components/three/globe-section.tsx` (главная-глобус).

---

## 📺 Текущая раскладка видео по страницам
| Страница | Видео (ключи R2_VIDEOS) |
|---|---|
| **Fashion** | calvinKlein, lime, demonessaMaster, incanto0404, incantoCentr, creationPolic4 |
| **Cinema** | reign, masterDynamic, mishanyaMaster, jimengTokusatsu, openartCinema, veneto |
| **Gaming** | reign, jimengWarriorsGaming, raidMasterfinal, smeh0424gaming |
| **TikTok (шар)** | masterDynamic, dance, lime, veneto + smeh100, icelandMaster, smeh0401, smeh0424tiktok, face01, openartTiktok, creationPolic4Tiktok + локальные v1–v8 |

> Примечание: `gaming/jimeng_warriors_01.mp4` по содержимому = «Fantasy warriors» (мастер обновлён 2026-06-05, имя ключа осталось). reign = RAID-мастер, показан и в Cinema, и в Gaming.

## ⏳ Открытые вопросы (ждут решения Pavel'а)
- **Старьё на R2** (incanto_02-05, demonessa_01, raid_battle, fantasy_film_01, orchiha, storyboard, voice_test, probe, и т.д.) — чистить или показывать? Удаление необратимо.
- **avatars / art / reels** — заводить ли под них страницы/спутники. (avatars отложены Pavel'ом.)
- **Пустые разделы** Tech / AI-Bots — заглушки «coming soon», ждут контента.

## 🔑 Ключевые файлы
```
lib/videos.ts                       # R2_VIDEOS + POSTERS — источник истины
components/ui/section-shell.tsx      # SectionShell + ShowcaseVideo (аспект, звук, постер, observer)
components/three/tiktok-canvas.tsx   # сфера: клипы+заглушки, трекбол, звук-фокус
components/three/globe-section.tsx   # главная: глобус-нав (Business последним)
components/ui/site-nav.tsx           # верхняя нав (Business последним)
components/BearBrickChat.tsx         # чат: таймаут + FAQ-фоллбэк
components/BearBrickClient.tsx       # мишка fixed bottom-right на всех страницах
app/{fashion,cinema,gaming}/page.tsx # разделы с видео
next.config.ts                       # output:export, trailingSlash, images.unoptimized
```
