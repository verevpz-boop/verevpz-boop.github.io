# ХЭНДОФФ — Голос Джарви: Cartesia Sonic + стриминг (2026-06-28)

> **Триггер для новой сессии:** Pavel говорит «Джарви голос» / «продолжаем голос Джарви» → читать ЭТОТ файл целиком, продолжать НЕ с нуля.
> Связано: `project_pavel_site_signature_head.md`, `HANDOFF_JARVI_HOST.md`, jarvis-memory mem667/mem669.

---

## TL;DR — где мы
Голос демо-Джарви на проде (`verevpz-boop.github.io/ai-bots/`) переведён с Silero на **Cartesia Sonic-3.5 (голос Sergei, русский)**, и сделан **потоковый TTS** (Джарви начинает говорить с первого PCM-чанка, ~90мс, не ждёт полный WAV). Pavel послушал — «шикарно». Дальше — делать ЕЩЁ быстрее (план ниже), но сессия перегружена → продолжаем в новой.

---

## ✅ ЧТО УЖЕ СДЕЛАНО И ЖИВО НА ПРОДЕ

1. **Cartesia как основной голос** (вместо Silero). Модель `sonic-3.5`, голос **Sergei — Steady Supporter**, `voice_id = 1e4176b1-3db9-44d6-a601-4fe68b041942`, `language: ru`.
2. **Потоковый TTS** (sub-90мс TTFB): клиент играет PCM-чанки (моно 16бит 24кГц) по мере прихода.
3. **Фоллбэк-цепочка цела:** стрим не завёлся → полный WAV Cartesia → Silero/Aeza → браузерный голос. Перебивание, эхо-щит, липсинк — сохранены.
4. Деплой: Worker (wrangler) + клиент (github.io, commit `c80f3e3`, GitHub Action зелёный).

### Архитектура (как устроено)
- **Worker** `jarvi-brain` (`jarvi-brain.pzverev.workers.dev`), код `D:\pavel-site\docs\worker\jarvi-brain.js`:
  - `POST /tts` — полный WAV: пробует Cartesia `/tts/bytes` (sonic-3.5, Sergei, ru, wav pcm_s16le 44100) → при сбое релей на Silero (`tts.pvcloud.uk`, Aeza). Заголовок `X-Jarvi-TTS: cartesia|silero`.
  - `POST /tts-stream` — **стриминг**: проксит Cartesia `/tts/sse` (output `raw` pcm_s16le **24000**) как есть; формат событий `event: chunk` + `data: {"type":"chunk","done":false,"data":"<base64 PCM>"}`, конец `done:true`. Заголовок `X-Jarvi-TTS: cartesia-stream`.
  - Секрет `CARTESIA_API_KEY` уже в Worker (wrangler secret). Деплой: `npx wrangler deploy -c wrangler-jarvi.toml`, токен CF из `КЛЮЧИ_И_ДОСТУПЫ.md` (`Select-String 'cfut_...'` → `$env:CLOUDFLARE_API_TOKEN`).
  - Константы Cartesia вверху файла: `CARTESIA_MODEL`, `CARTESIA_VERSION="2025-04-16"`, `CARTESIA_VOICE_ID`.
  - 🔑 Worker→Cartesia идёт НАПРЯМУЮ с CF-эджа (Aeza НЕ в пути — как и мозги; «через VPN» в наших тестах = артефакт того, что курлили с ПК Pavel через Hiddify).
- **Клиент** `D:\pavel-site\components\jarvi\jarvi-engine.ts`:
  - `playSentenceStream(text, turn)` — фетчит `/tts-stream`, парсит SSE, декодит base64→Int16→Float32→AudioBuffer(1ch,24000), планирует гаплесс по курсору, src→`this.analyser` (липсинк), src в `this.liveStreamSources` (барж-ин гасит). Возвращает false → фоллбэк на `fetchTts`+`playBuffer`.
  - `runLiveLoop` зовёт `playSentenceStream` (по предложениям), `greet()` тоже.
  - `stopSpeech` ставит `streamCancelled=true` и стопает все `liveStreamSources` (барж-ин).
  - Слух/мозг/эхо — без изменений.

---

## 💾 БЭКАПЫ — путь отката на «как было» (бесплатный Silero, тише но даром)

Pavel: «если вдруг захочу вернуться к тому качеству, что устраивало — полностью бесплатное и долгое».
Тот вариант = **Silero v4 (eugene) на Aeza** (свой сервер, $0, чуть медленнее, без облачной зависимости).

| Бэкап | Что это | Откат |
|---|---|---|
| `D:\pavel-site\docs\worker\jarvi-brain.js.bak_20260628_211920` | Worker ДО Cartesia (чистый Silero-релей) | скопировать поверх `jarvi-brain.js` → `wrangler deploy` |
| `D:\pavel-site\components\jarvi\jarvi-engine.ts.bak_20260628_213413` | Клиент ДО стриминга (полный WAV → playBuffer) | скопировать поверх `jarvi-engine.ts` → `npm run build` → commit → push |

**Лёгкий частичный откат (без бэкапов):** убрать секрет `CARTESIA_API_KEY` из Worker (`wrangler secret delete CARTESIA_API_KEY`) → `/tts` сам падает на Silero; но `/tts-stream` тогда отдаёт 503, и клиент уйдёт в фоллбэк на полный WAV-Silero (работает, просто без стрима). Полный откат на «бесплатное и долгое как раньше» = вернуть ОБА `.bak`.

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ — сделать ещё быстрее (одобрено Pavel'ом, по убыванию выигрыша)

Стриминг-TTS уже почти на дне (~90мс). Осталось два жирных куска ДО голоса + крупная переделка:

1. **🥇 VAD `redemptionMs` 500→~300мс** (`jarvi-engine.ts` → `startHearing`, объект MicVAD.new). Минус ~200мс на КАЖДЫЙ ответ, 1 строка. Риск: при паузе в середине мысли ответит рановато (барж-ин ловит). Тюнингуется. **Самый дешёвый — сделать первым.**
2. **🥈 Стриминговый STT — Cartesia Ink** вместо CF-Whisper (`/stt` в Worker + клиентский слух). Ink распознаёт ПОКА гость говорит → к моменту «замолчал» текст почти готов. Аккаунт Cartesia уже есть. Самый большой реальный рывок. Средняя переделка (новый стрим-канал слуха: клиент шлёт аудио-чанки с мика в Ink-WS, не один кусок в Whisper).
3. **Озвучка с первого КУСКА фразы** (split по запятой, не ждать `.!?`) — `splitSentences`/`enqueueSentence`. Дёшево, риск чуть рубленой интонации.
4. **🔥 Токены мозга → прямо в Cartesia WebSocket** (input-streaming TTS: Джарви озвучивает, ПОКА мозг ещё пишет ответ) — Pavel хочет, «было бы круто, срочно». Максимум скорости, но КРУПНАЯ переделка: Worker бриджит LLM-SSE → Cartesia `/tts/websocket` → клиент. Делать после 1–2.

**Перед шагом 2 (Ink):** замерить реальную раскладку латентности на живом тесте — у движка есть трасса `window.__jtrace` (кольцо) + `onLatency` («замолчал→первый звук»). Резать прицельно, не на глаз.

---

## 🔴 ОТКРЫТЫЕ ХВОСТЫ (не потерять)

1. **БЕЗОПАСНОСТЬ — перевыпустить ключ Cartesia.** `sk_car_...` засветился в чате Claude 2026-06-28. `play.cartesia.ai → API Keys → новый, старый удалить → новый дать Claude` → обновить `wrangler secret put CARTESIA_API_KEY` + строку в `КЛЮЧИ_И_ДОСТУПЫ.md` (секция 3, Cartesia).
2. **Память-сервер ждёт рестарта.** Фикс авто-вытеснения (`gate.py SUPERSEDE_MODE="log"`) и новый MCP-инструмент `delete_memory` (дописан в `mcp_server.py`) — на ДИСКЕ, но сервер крутит старый код. До рестарта: авто-supersede всё ещё бьёт (сохраняю с `force=true` в обход); delete делаю через HTTP `DELETE /memory/{id}` напрямую. Активация: `start_api.bat` (uvicorn :8770) + рестарт Claude Code (для MCP-ручки). По команде Pavel.
3. **kwork/Hiddify IPv6 (другой топик сессии).** kwork ломается на direct из-за IPv6-only CDN (`cdn.kwork.ru` AAAA `2a11:27c0:10::182`), а у провайдера маршрут к этой подсети мёртв → 5с-таймауты. Тумблер «Маршрут IPv6→Отключить» НЕ помог (не применился / не та ручка). Правильная ручка — DNS-стратегия `prefer_ipv4` для direct (раздел Настройки→DNS в Hiddify). Не доделано — Pavel переключился на голос. Бэкап конфига Hiddify: `AppData\Roaming\Hiddify\_backup_2026-06-27`.

---

## КЛЮЧЕВЫЕ ФАКТЫ ОДНОЙ СТРОКОЙ
- Голос: Cartesia sonic-3.5, Sergei `1e4176b1-3db9-44d6-a601-4fe68b041942`, ru. Free-тир 20K кредитов/мес (демо = копейки).
- Worker version после стрима: `763b0612...` (последний `wrangler deploy`). Сайт commit `c80f3e3`.
- 🔑 Правка голоса в Worker = САЙТ ПЕРЕСОБИРАТЬ НЕ НАДО (серверная). Правка клиента (jarvi-engine) = нужен `npm run build` + push master → github.io авто-деплой.
- Память: mem667 (кандидат), mem669 (живое решение), mem641/660 (контекст хоста).
