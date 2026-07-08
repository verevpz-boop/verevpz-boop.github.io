# ХЭНДОФФ — Голос Джарви: Cartesia Sonic + стриминг (2026-06-28)

> **Триггер для новой сессии:** Pavel говорит «Джарви голос» / «продолжаем голос Джарви» → читать ЭТОТ файл целиком, продолжать НЕ с нуля.
> Связано: `project_pavel_site_signature_head.md`, `HANDOFF_JARVI_HOST.md`, jarvis-memory mem667/mem669.

---

## TL;DR — где мы
**🏁 2026-07-08 — ПРОЕКТ ЗАВЕРШЁН. Pavel слушал вживую: «работает, устраивает полностью».** Больше НЕ переписывать без явного запроса. Принятый боевой конфиг: `stt=ink`, `pipeline=sentence`, Cartesia Sonic-3.5 Sergei ru стриминг. WS-ветка (`pipeline=ws`, шаг 4) осталась ЗА ТУМБЛЕРОМ OFF — не понадобилась; открытый баг #2 «съедает окончания» жил именно в ней, в sentence-конфиге не мешает. Глубокое сравнение с Pipecat (вывод «не мигрировать, наш стек под наш случай не хуже»): `COMPARE_JARVI_VS_PIPECAT_2026-07-08.md`. Память: mem884 (завершён), mem885 (сравнение Pipecat).

Голос демо-Джарви на проде (`verevpz-boop.github.io/ai-bots/`): Cartesia Sonic-3.5 (Sergei, ru) + потоковый TTS (~90мс). Pavel послушал — «шикарно».

**🆕 2026-07-03 ночь (Fable 5, го Pavel «понты на демо AIRSAT»): Джарви знает интерфейс AIR SATELLITE.**
В `jarvi-engine.ts` добавлена `AIRSAT_CONTEXT` (~5К симв.: словарь режиссёра, экран, слоты, кран/телескоп/телега,
таймлайн, метка, Delete-слот, тэлли, ЧАСТЫЕ ВОПРОСЫ). 🔑 ГРАБЛЯ+ОБХОД: Worker режет КАЖДОЕ сообщение до
2000 симв. (`content.slice(0,2000)`, jarvi-brain.js) → контекст теперь едет НАРЕЗКОЙ `contextMessages()`
(куски ≤1900 по границе предложения; бюджет MAX_HISTORY=24: 1 студия + ~4 AIRSAT + 16 истории = влезает,
Worker НЕ трогали). Проверено Node-харнессом напрямую в Worker /chat: 5/5 вопросов («как качнуть стрелу»,
«удалил кадр», «где метка», «телескоп vs кран», «нейросети Pavel») — ответы в масть, студийные знания целы.
Обновлять базу = править AIRSAT_CONTEXT + push сайта (Worker не нужен).

**🆕 2026-06-28 ночь, автономный заход (Pavel уехал, велел сделать всю цепочку ускорения по кругу):** проделаны ВСЕ 4 шага ускорения. Шаги 1-3 + стриминг-STT (Ink) — ЖИВЫ НА ПРОДЕ ПО УМОЛЧАНИЮ. Шаг 4 (мозг→Cartesia WS) — построен, задеплоен, серверно проверен, но КЛИЕНТ ЗА ТУМБЛЕРОМ OFF (ждёт ушного теста Pavel'а). Всё проверено на сервере (Node-харнесс) и из живого Chrome Pavel'а (CORS+WS), КРОМЕ реального мик-цикла (нужны уши Pavel'а). Детали ниже.

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

## 🎯 ЦЕПОЧКА УСКОРЕНИЯ — СТАТУС (всё проделано в ночь 2026-06-28)

1. **✅ VAD `redemptionMs` 500→300мс** — `jarvi-engine.ts` startHearing. ЖИВО. commit `d8b0415`. Минус ~200мс/ответ. Риск: при паузе в середине мысли ответит рановато → если перебивает, вернуть 350-400.
2. **✅ Стриминг-STT Cartesia Ink** — ЖИВО ПО УМОЛЧАНИЮ (`config.stt="ink"`). commit `2f91ce1`.
   - Worker `/stt-stream`: двунаправленный WS-мост браузер↔Cartesia Ink (model `ink-whisper`, ru; `ink-2` русский НЕ поддерживает). Ключ на сервере.
   - Замер: `finalize→финал` 18-190мс против ~500мс round-trip Whisper-batch — режет ~⅓ латентности «замолчал→первый звук».
   - Клиент: во время речи стримит PCM-фреймы мика (`onFrameProcessed`) в Ink с пред-речевым кольцом; на speechEnd `finalize` → накопленный транскрипт. **При ЛЮБОМ сбое/пустоте/таймауте(900мс) — авто-фоллбэк на Whisper-batch. Worst-case = текущее поведение.**
   - ⚠️ УШНОЙ ТЕСТ: ink-whisper интермиттентно догаллюцинирует короткий хвост («Продолжение») на финализации. Если мешает — флип `config.stt="whisper"` (public/jarvi-config.json, push, без пересборки логики).
3. **✅ Озвучка с первой длинной клаузы** — ЖИВО. commit `d4e2206`. `splitSentences(allowSoftFirst)`: первую клаузу длинного ответа флашим по запятой если ≥32 симв (короткие не рубим). Один шов на ответ, поздняя запятая = естественная точка вдоха.
4. **⏸️ Мозг→Cartesia WS (input-streaming TTS)** — ПОСТРОЕН+ЗАДЕПЛОЕН, КЛИЕНТ ЗА ТУМБЛЕРОМ `config.pipeline` (по умолч. `"sentence"` = текущий; `"ws"` = новый). commit `58ba516`.
   - Worker `/chat-voice`: failover-мозг (как /chat) → токены по словам в Cartesia TTS WS (continuations, один context_id) → аудио обратно. Мультиплекс SSE: `{type:text,delta}` + `{type:chunk,data}` (base64 PCM s16le 24к).
   - Серверно проверено: текст+аудио одним потоком, первое аудио ~180мс после первого слова мозга, из Chrome Pavel'а (CORS) тоже OK.
   - Выигрыш в основном — СКВОЗНАЯ ПРОСОДИЯ (нет сброса между предложениями), латентность уже перекрыта тем, что текущий конвейер УЖЕ пайплайнит предложения. **Судится УХОМ.** Включить: `config.pipeline="ws"` → push → послушать. Сбой /chat-voice → авто-фоллбэк на askBrain.

**Worker version после всех шагов:** `909675d0...` (последний `wrangler deploy`). Сайт commit `58ba516`.
**Тест-харнесс (scratchpad, не в репо):** `jtest.mjs` (tts/stt/loop), `inktest.mjs` (Ink WS + замер finalize), `chatvoicetest.mjs` (/chat-voice мультиплекс), `splittest.mjs` (логика клауз). Все на Node v25 (глобальный WebSocket).

**Трасса латентности:** `window.__jtrace` (кольцо) + `onLatency` («замолчал→первый звук»). Резать прицельно.

---

## 🔴 ОТКРЫТЫЕ ХВОСТЫ (не потерять)

1. ~~Перевыпустить ключ Cartesia~~ — **СНЯТО Pavel'ом 2026-06-28 ночью: «бесплатный, хуй с ним».** Ключ `sk_car_...` оставлен как есть.
2. **Память-сервер ждёт рестарта.** Фикс авто-вытеснения (`gate.py SUPERSEDE_MODE="log"`) и новый MCP-инструмент `delete_memory` (дописан в `mcp_server.py`) — на ДИСКЕ, но сервер крутит старый код. До рестарта: авто-supersede всё ещё бьёт (сохраняю с `force=true` в обход); delete делаю через HTTP `DELETE /memory/{id}` напрямую. Активация: `start_api.bat` (uvicorn :8770) + рестарт Claude Code (для MCP-ручки). По команде Pavel.
3. **kwork/Hiddify IPv6 (другой топик сессии).** kwork ломается на direct из-за IPv6-only CDN (`cdn.kwork.ru` AAAA `2a11:27c0:10::182`), а у провайдера маршрут к этой подсети мёртв → 5с-таймауты. Тумблер «Маршрут IPv6→Отключить» НЕ помог (не применился / не та ручка). Правильная ручка — DNS-стратегия `prefer_ipv4` для direct (раздел Настройки→DNS в Hiddify). Не доделано — Pavel переключился на голос. Бэкап конфига Hiddify: `AppData\Roaming\Hiddify\_backup_2026-06-27`.

---

## 🐛 ИЗВЕСТНЫЕ БАГИ — помнить и чинить при ЛЮБЫХ правках голоса (распоряжение Pavel'а 28.06)
> Правило Pavel'а: где бы мы ни остановились — баги фиксируем «по-любому», держим их в памяти и не забываем при новых историях.

1. **✅ ФИКС (commit 6cd32aa) — «через время Джарви перестаёт слышать/отвечать».** Дедлок в Ink-слухе: `inkCloseWs` гасил таймаут finalize, но не резолвил висящий `await onSpeechEnd` → `sttInFlight` застревал `true` → новые реплики не обрабатывались (кредиты при этом целы — сбивает с толку). Триггер: новая реплика началась, пока прошлая ещё финализировалась. Фикс: `inkCloseWs` теперь всегда резолвит ожидание; + `fetchStt` получил `AbortSignal.timeout(8000)` (второй латентный дедлок в фоллбэк-Whisper). **Класс багов:** застрявший флаг-однопроходник (`sttInFlight`, `livePlaying`, `inkStreaming`) — ВСЕГДА следи, что любой `await` в петле слух/голос гарантированно завершается (таймаут или резолв на закрытии).
2. **⏳ ОТКРЫТО — «иногда съедает окончания слов / странная интонация».** Не локализовано в коде (серверно /chat-voice отдаёт полный текст+аудио). Подозреваемые: артефакт Cartesia на коротких клаузах (шаг 3) ИЛИ шаг 4 (WS `pipeline=ws`, включён 77c2a2b) подрезает хвост. ДИАГНОСТИКА: вернуть `config.pipeline="sentence"` и/или `stt="whisper"`, сравнить ухом — что уберёт симптом, то и виновник. Нужен ушной A/B Pavel'а.

## КЛЮЧЕВЫЕ ФАКТЫ ОДНОЙ СТРОКОЙ
- Голос: Cartesia sonic-3.5, Sergei `1e4176b1-3db9-44d6-a601-4fe68b041942`, ru. Free-тир 20K кредитов/мес (демо = копейки).
- Worker version после стрима: `763b0612...` (последний `wrangler deploy`). Сайт commit `c80f3e3`.
- 🔑 Правка голоса в Worker = САЙТ ПЕРЕСОБИРАТЬ НЕ НАДО (серверная). Правка клиента (jarvi-engine) = нужен `npm run build` + push master → github.io авто-деплой.
- Память: mem667 (кандидат), mem669 (живое решение), mem641/660 (контекст хоста).
