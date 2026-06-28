# 🗺️ JARVI BUILD ROADMAP — как собрать говорящего аватара с нуля и не потерять дни

> **Зачем этот файл.** Мы дважды-трижды переоткрывали одни и те же решения, потому что
> записывали только тупики, а **победы — нет**. Это канон победившей архитектуры Джарви:
> что выбрано, ПОЧЕМУ, и какие пути уже сожжены (чтобы в них больше не лезть).
> Кто строит «ещё одного Джарви» — читает ЭТОТ файл первым. Связанные: `TZ_JARVI.md`
> (ТЗ), `SIGNATURE_HEAD.md` (визуал головы), `SITE_DECISIONS.md` (журнал сайта).
>
> Дата последней крупной правки: **2026-06-13** (слух переведён на VAD + Cloudflare Whisper).

---

## 0. Что такое Джарви (одной фразой)
Живой разговорный аватар-дворецкий на сайте-портфолио: **слышит гостя → думает → отвечает
голосом → его можно перебить на полуслове.** Сам по себе — демонстрация того, что умеет студия.

## 1. ЖЕЛЕЗНЫЕ ПРАВИЛА (не обсуждаются, нарушение = переделка)
1. **Перебивание голосом — НЕРУШИМАЯ центральная фишка.** «Чаты строят все, фишка — перебивание». Рация (half-duplex) и перебивание-по-клику — ОТКЛОНЕНЫ навсегда.
2. **Бесплатно.** Платных API нет. Только free-тарифы и локалки.
3. **Работает у ЛЮБОГО зрителя с телефона.** Не «у Pavel'а на localhost». iPhone/Android/десктоп, любой браузер. → решения, завязанные на ПК Pavel'а, для ПРОДА запрещены.
4. **Реалтайм, потолок ≤1с на отклик.** «Может тупить, но мгновенно».
5. **VPN Pavel'а (Hiddify) НЕ выключать** — на нём работает Claude и сам Pavel. → всё, что Pavel тестит, должно работать ПОД VPN.
6. **Прод serverless, без ПК и туннелей.** Хостинг статики — GitHub Pages; серверная логика — Cloudflare Worker.

## 2. TL;DR — ПОБЕДИВШИЙ СТЕК (копируй это)
```
Браузер зрителя (любой, вкл. iPhone)
  ├─ ГОЛОВА: three.js wireframe-голова (LeePerrySmith.glb), липсинк = деформация ЧЕЛЮСТИ по амплитуде аудио
  ├─ СЛУХ:  VAD (Silero, @ricky0123/vad-web) на echoCancellation-потоке
  │          • onSpeechStart → МГНОВЕННОЕ перебивание (cancel голоса + abort мозга)
  │          • onSpeechEnd(Float32@16к) → WAV→base64 → POST /stt
  ├─ ГОЛОС: живой нейро-TTS играет через WebAudio (AudioContext) — ОБЯЗАТЕЛЬНО живой,
  │          т.к. только так Chrome-AEC вычитает голос Джарви из микрофона (см. §4.3)
  └─ всё общение по HTTPS на Cloudflare Worker:
        Cloudflare Worker  jarvi-brain.pzverev.workers.dev  (аккаунт Pavel'а, бесплатно)
          ├─ /chat  → FAILOVER цепочка: Cerebras→Groq→Mistral→Gemini (OpenAI-совместимые, ключи в секретах)
          ├─ /stt   → Workers AI  @cf/openai/whisper-large-v3-turbo  (язык ru, free 10k нейронов/сут)
          ├─ /tts   → edge-tts (см. §4.4 — для ПРОДА нужен сайдкар, edge-tts с IP CF = 403)
          └─ /health
```
**Файлы:** клиент `components/jarvi/jarvi-engine.ts`; Worker `docs/worker/jarvi-brain.js` + `wrangler-jarvi.toml`;
конфиг рантайма `public/jarvi-config.json`; деплой `docs/worker/ДЕПЛОЙ_МОЗГА_TTS.bat`.

## 3. ПОЧЕМУ ИМЕННО ТАК — ключевые развилки
| Узел | Выбор | Почему он, а не иначе |
|------|-------|----------------------|
| **Мозг** | Cloudflare Worker + failover-цепочка | Статика github.io не держит ключи. Worker = постоянный адрес, ~0.4-0.6с TTFT, вне РФ → провайдеры напрямую. Failover как в стеке Pavel'а — один лёг, берётся следующий. |
| **Слух** | VAD (клиент) + Whisper (Workers AI) | Web Speech мёртв (см. §5). VAD ловит барж-ин локально и мгновенно; Whisper на edge-GPU расшифровывает у любого зрителя, телефон только пишет+шлёт (легко). Free-тариф. |
| **Перебивание** | клиентский VAD `onSpeechStart` | Срабатывает локально за десятки мс, без сети. Это и делает фишку мгновенной. |
| **Анти-эхо** | живой голос через WebAudio + AEC Chrome + текстовый бэкап-фильтр | Единственное, что реально гасит петлю «сам с собой» на десктопе с колонками (см. §4.3). |
| **Голова** | three.js wireframe, липсинк челюстью | «Пиздато» = риг+виземы+свет, НЕ фотореал-нейронки. Липсинк по амплитуде реального аудио. НЕ привязывать к bbox.min.y (там плечи). |
| **Хостинг** | GitHub Pages, авто-деплой по push | Бесплатно, постоянный адрес, без сервера. |

## 4. КРИТИЧНЫЕ ТЕХ-ФАКТЫ (выстраданы замерами — не переоткрывать)
**4.1. Whisper на Workers AI.** Модель `@cf/openai/whisper-large-v3-turbo`. Вход: `{ audio: "<base64 аудиофайла>", language: "ru", task: "transcribe" }` — **audio это base64-СТРОКА** (не массив байт; массив байт — у старой `@cf/openai/whisper`). Выход: `{ text, word_count, ... }`. Биндинг в wrangler: `[ai]\nbinding = "AI"`, вызов `env.AI.run(...)`. Free 10 000 нейронов/сутки, карта не нужна.

**4.2. VAD (@ricky0123/vad-web).** `MicVAD.new({...})`. `onSpeechEnd(audio)` отдаёт **Float32Array @16 кГц** (ровно вход Whisper после WAV-обёртки). Свой echoCancellation-поток — через `getStream: async()=>myStream`. Модель/ворклет/wasm грузить с CDN: `baseAssetPath = https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@<ver>/dist/`, `onnxWASMBasePath = .../onnxruntime-web@<ver>/dist/` (версии — из package.json, сейчас 0.0.30 / 1.26.0). Модель `"v5"`. Тюнинг: `positiveSpeechThreshold`, `minSpeechMs`, `redemptionMs`. ⚠️ На части iPhone бывает «WASM memory out of range» (issue #134) — держать запасной простой детектор.

**4.3. 🔑 ГЛАВНЫЙ ФАКТ ПРО ЭХО (RMS-замер, скептик подтвердил):** браузерный `speechSynthesis` идёт МИМО аудиотракта Chrome (через SAPI) → встроенное эхоподавление (AEC) его НЕ гасит (~−3дБ). Настоящий аудиофайл, сыгранный через **WebAudio (AudioContext)**, AEC давит ~−18дБ. **Поэтому живой голос (нейро-TTS, проигранный как AudioBuffer) — техническая НЕОБХОДИМОСТЬ, а не «качество»:** только он позволяет AEC вычесть Джарви из микрофона, чтобы VAD не ловил его собственный голос. На телефонах аппаратное AEC сильнее и может гасить даже speechSynthesis; десктоп-с-колонками — самый тяжёлый случай.

**4.4. edge-tts с IP Cloudflare = 403.** Microsoft режет дата-центр IP. Worker `/tts` (edge-tts по WebSocket) работает с домашнего/Aeza-IP, но НЕ с самого CF. Для ПРОДА: edge-tts/Silero сайдкар на **Aeza-Helsinki** + Worker-релей (скептик: с IP Aeza edge-tts работает 3/3). Локально (local_test_backend.py) edge-tts работает напрямую. (CF Worker для исходящего WebSocket требует схему `https://`, не `wss://`.)

**4.5. wrangler на Windows.** `"ключ" | wrangler secret put` клеит `\r` → 401 у всех провайдеров. Лечение: `wrangler secret bulk file.json`. Деплой Worker блокирует авто-классификатор → **только руками Pavel** (`ДЕПЛОЙ_МОЗГА_TTS.bat`, тянет cfut-токен из КЛЮЧИ).

## 5. 🪦 КЛАДБИЩЕ ТУПИКОВ (сюда НЕ возвращаться — проверено, не работает)
- **Web Speech API (браузерная распознавалка)** — МЁРТВ как путь. (а) Нет на iPhone/Safari и Firefox → «любой зритель» отпадает. (б) На машине Pavel'а под Hiddium-VPN облачный Google STT не отвечает: `onaudiostart`+`onspeechstart` срабатывают (звук доходит, peak 0.45), но `onresult` НИКОГДА не приходит, только `no-speech`. Замер 2026-06-13 на `public/jarvi-stt-test.html`. *Нюанс: 12.06 была эхо-петля = тогда расшифровывал → ломается по сети, не «навсегда». Но как фундамент — ненадёжен, выкинут.*
- **`recognition.start(track)`** (кормить Web Speech echoCancellation-трек) — НЕ виновник глухоты и НЕ решение: глух и plain `start()`. Гипотеза закрыта.
- **Локальный Whisper на ПК Pavel'а как ПРОД** — отпадает: живёт только пока его машина включена+протуннелена, не масштабируется на «любого». (Для локального теста — ок, но мы выбрали сразу прод-путь CF.)
- **ПК-туннель для мозга/голоса** (localhost.run / serveo / cloudflared) — закрыт как класс: эфемерные URL (config устаревает → «МОЗГ СПИТ»), interstitial без CORS (fetch с github.io падает), cloudflared не коннектится через Hiddify (TLS EOF на edge). Авто-keeper и VPS-SSH блокирует классификатор. → ушли на Cloudflare Worker.
- **Рация / half-duplex** (мик физически закрыт пока Джарви говорит) — убивает перебивание-голосом. ОТКЛОНЕНО Pavel'ом. Патч-могила: `docs/jarvi-ratsiya-wip.patch`.
- **Перебивание по клику** — ОТКЛОНЕНО (фишка должна быть голосом).
- **Текстовый эхо-щит как ЕДИНСТВЕННАЯ защита** — недостаточно: STT коверкает эхо, слова не совпадают, фильтр не узнаёт. Работает только КАК БЭКАП поверх аппаратного AEC.
- **Голова-шар (икосаэдр из старого макета /head)** — это плейсхолдер, НЕ голова. Канон — человеческая wireframe-голова (см. `refs/signature-head-reference.md`).
- **TTS прямо на Cloudflare Worker через edge-tts** — 403 (см. §4.4).
- **FreeTTS API (freetts.org) как прод-голос** — пробовано 2026-06-24: keyless, русский `ru-RU-DmitryNeural` ЕСТЬ, обходит 403 (Worker→freetts→Azure). НО синтез **~16.6с** + вернул **0 байт** аудио. Реалтайм ≤1с убит наглухо. Дохлый.
- **CF Workers AI нативный TTS (Aura/Deepgram, MeloTTS) для РУССКОГО** — русского НЕТ (Aura: EN/ES/DE/FR/NL/IT/JA; MeloTTS: EN/ES/FR/ZH/JA/KO; проверено 2026-06-24). «Голос на самом Worker'е без внешних зависимостей» для русского НЕ существует.
- **ВЫВОД 2026-06-24:** быстрый (≤1с) + русский + бесплатный + достижимый-с-CF облачный TTS — НЕ найден. Silero-на-Aeza (~0.8с) остаётся единственным фитом под реалтайм-русский. Значит проблема не в ВЫБОРЕ голоса (он правильный), а в НАДЁЖНОСТИ туннеля Aeza → «правильно» = захардить этот путь (auto-restart keeper + честный /health), а не менять на медленное облако.

## 6. СБОРКА С НУЛЯ (порядок шагов)
1. **Worker-мозг.** `docs/worker/jarvi-brain.js` + `wrangler-jarvi.toml`. Секреты провайдеров (`wrangler secret bulk`). Деплой `ДЕПЛОЙ_МОЗГА_TTS.bat`. Проверка: `/health` → `{ok:true, stt:true, tts:true}`.
2. **Слух.** В wrangler добавить `[ai] binding="AI"`; в Worker — `/stt` на `@cf/openai/whisper-large-v3-turbo`. Передеплой.
3. **Клиент-движок.** `components/jarvi/jarvi-engine.ts`: VAD (getStream = echoCancellation-поток) → onSpeechStart=барж-ин, onSpeechEnd→/stt→/chat; голос через WebAudio.
4. **Конфиг.** `public/jarvi-config.json`: `{chatBase, sttBase, voice}`. Прод = всё на `jarvi-brain.workers.dev`. Локальный тест = `chatBase: localhost:8787`, `sttBase: <CF Worker>`, `voice: live`.
5. **Голова + страница.** three.js, кнопка старта (нужна user-activation для мика и разблокировки звука).
6. **Голос для прода** (см. §4.4 / §8) — edge-tts/Silero сайдкар на Aeza + релей.
7. **Тест ушами Pavel'а.** Реальный разговор + перебивание машинно не проверить.

## 7. 💣 ЛАНДМАЙНЫ ОКРУЖЕНИЯ (durable)
- **Мик:** `Razer Megalodon` — рабочий. `Steam Streaming Microphone` — МЁРТВЫЙ виртуальный (был системным дефолтом! дефолт сменён на Razer).
- **Handy** (локальный Whisper-ввод Pavel'а) держит микрофон при диктовке → **закрывать перед тестом Джарви**, иначе мик занят.
- Pavel слушает через **КОЛОНКИ**, не наушники → петля реальна, обход «дай наушники» не подходит.
- **Старт только из клика** — мик и разблокировка `speechSynthesis`/AudioContext требуют user-activation.
- **Деплой Worker — только руками Pavel** (классификатор; см. §4.5).
- `public/jarvi-config.json` во время локального теста указывает на localhost — **вернуть прод-значения перед коммитом/push.** Тест-стенд `public/jarvi-stt-test.html` — удалить перед прод-коммитом.

## 8. ОТКРЫТЫЕ РАЗВИЛКИ (ещё не закрыты)
- **Голос Джарви для ПРОДА.** Нужен живой нейро-TTS, играющий через WebAudio (иначе эхо на десктопе, §4.3), но бесплатный и доступный любому зрителю. Кандидаты: edge-tts/Silero сайдкар на Aeza + Worker-релей; облачный нейро-TTS (упирается в аккаунт/номер-якорь); на телефонах, возможно, хватит браузерного из-за сильного аппаратного AEC. РЕШАЕТ Pavel.

### ✅ 2026-06-24 — ГОЛОС ПРОДА ПОЧИНЕН (диагноз туннеля Silero/Aeza)
Симптом: на проде эхо-петля вернулась = Worker `/tts` → 502, `tts.pvcloud.uk` → 530. Silero сам жив (локально `/tts` 200/40КБ).
**Корень (3 слоя, копали по одному):**
1. **Туннель `jarvi-tts` (3e97966d) ОСИРОТЕЛ** — cloudflared-сервис на Aeza когда-то переустановили на токен туннеля `pvcloud-vpn` (05eed741, VLESS-VPN, ingress `vpn.pvcloud.uk→:8880`). Один systemd cloudflared = один токен → jarvi-tts остался без носителя → INACTIVE → 530. (Случилось ДО сессии 06-24; локальные тесты шли через local edge-tts, маскировали.)
2. **Фикс маршрута (CF API, Aeza НЕ трогали):** дописали в ingress ЖИВОГО `pvcloud-vpn` правило `tts.pvcloud.uk→http://localhost:8791` (перед catch-all) + переключили DNS-CNAME `tts.pvcloud.uk` с 3e97966d на 05eed741. `vpn.pvcloud.uk` и warp-routing не тронуты. → `/health` через туннель ожил (200).
3. **POST `/tts` всё равно 502** = Silero на **Werkzeug dev-сервере** (threaded=False) давится **chunked**-телом от cloudflared. Фикс: в tts-ingress-правило добавили `originRequest:{disableChunkedEncoding:true}` → Worker `/tts` 200/audio-wav. (Durable-better: пересадить Silero на gunicorn — отложено.)
🪦 **Красная селёдка (не повторять диагностику):** PowerShell `Invoke-WebRequest -Body '<кириллица>'` шлёт тело в **Latin-1** → Silero `apply_tts` давится мусором → 502 «synth failed» (`aeza_tts_server.py:73`). Это АРТЕФАКТ ТЕСТ-КЛИЕНТА, не сервер. Слать `[Text.Encoding]::UTF8.GetBytes(...)` + `charset=utf-8`. Worker шлёт чистый UTF-8 — у него такой проблемы нет.
🔴 **Остаточная хрупкость:** cloudflared 2026.5.0 на Aeza ловит периодические `Failed to refresh DNS resolver i/o timeout` → туннель может флапнуть снова. Hardening на потом: апгрейд cloudflared + watchdog. SSH Aeza: root@91.108.241.13 (пароль в КЛЮЧИ), сервис `jtts` (Silero :8791) + `cloudflared`. CF API-токен: `E:\Projects\jarvi-server\.cftok`.

## 9. ИСТОРИЯ КРУПНЫХ РЕШЕНИЙ (кратко, по датам)
- **2026-06-12:** имя «Джарви»; планка визуала «пиздато, цена=скорость»; мозг переехал в Cloudflare Worker (Путь 2 Pavel'а), ПК выведен из схемы; перебивание объявлено нерушимым.
- **2026-06-13:** диагноз глухоты — виноват Web Speech, не `start(track)`; слух переведён на **VAD + Cloudflare Whisper** (этот документ).
- **2026-06-24:** **ГОЛОВА переведена с wireframe на готовый VRM-аватар** (см. ниже).

### ✅ 2026-06-24 — ОБЛИК: wireframe-голова → VRM-аватар «Savi Butler»
Грубую wireframe-голову (LeePerrySmith.glb + липсинк челюстью) заменили на готового 3D-героя.
- **Модель:** `public/models/jarvi-butler.vrm` — «Savi Butler Outfit» с VRoid Hub (VRM 0.0). Лицензия чистая: Avatar/Corporate/Commercial/**Redistribution**/**Alterations** = Allow, атрибуция не нужна. 🔑 Redistribution+Alterations обязательны нам (хостим .vrm публично на Pages + правим blendshape-визему) — под этот фильтр на VRoid почти все «дворецкие» отваливаются, Savi — редкий чистый фит. Аккаунт VRoid: ник PZ4417 (вход pixiv).
- **Рендер:** `@pixiv/three-vrm` (v3) в `components/jarvi/jarvi-head.tsx`. Грузим через `useLoader(GLTFLoader, …, l=>l.register(p=>new VRMLoaderPlugin(p)))`, `gltf.userData.vrm`. Для VRM0 — `VRMUtils.rotateVRM0(vrm)` (лицом к +Z/зрителю), иначе спиной. Дефолтная T-поза → опускаем руки через `humanoid.getNormalizedBoneNode('leftUpperArm'…).rotation.z`. Кадр по грудь считаем из bbox. Каждый кадр `vrm.update(delta)`.
- **Привязка движка (НЕ менялся):** `driver.mouth (0..1) → vrm.expressionManager.setValue('aa', …)` = липсинк; `'blink'` по таймеру; `vrm.lookAt.lookAt(camera)` = взгляд на зрителя; idle-покач; рим-свет по state.
- 🪦 **Грабли (не повторять):** `@ricky0123/vad-web` + `onnxruntime-web` на ветке были «висячими» (не в package.json) → **любой `npm install` их пруннит** и ломает слух. Лечение: они теперь в package.json master. На чужой ветке не ставить пакеты через --no-save поодиночке (второй install сносит первый).
- ⚠️ **Публикация:** делали с master (НЕ с two-door-redesign — там коммит «НЕ публиковать»). Безопасно: worktree `jarvi-live` от master → налили дельту (head+vrm+three-vrm) → локальный `next build` → ff в master → push → Pages. Прод: https://verevpz-boop.github.io/ai-bots/ (master `1d0a862`).
- 🔶 **Хвосты:** VRM 18.7 МБ — тяжело для телефонов, кандидат на сжатие (gltf-transform/Draco/мешоптимизация). Тонкая доводка позы/света/кадра — по желанию Pavel'а.
