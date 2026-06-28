/**
 * Джарви — МОЗГ в Cloudflare Worker (Путь 2, решение Pavel'а 2026-06-12).
 *
 * Зачем: статика на github.io не может держать ключи; ПК-туннель был медленным
 * (0.9-1.2с, скачет) и зависел от включённого ПК. Worker живёт на краю Cloudflare:
 * ~0.4-0.6с до первого токена, адрес постоянный, ПК и VPN-инфра НЕ участвуют.
 *
 * FAILOVER по канону стека Pavel'а (как pavel-main → fallbacks в LiteLLM):
 *   Cerebras (gpt-oss-120b, reasoning low) → Groq (llama-3.3-70b) →
 *   Mistral (mistral-large) → Gemini (2.5-flash, OpenAI-совместимый эндпоинт).
 * Один мозг лёг (не-2xx/таймаут) — берётся следующий, зритель не замечает.
 *
 * Деплой:  wrangler deploy -c wrangler-jarvi.toml
 * Секреты: wrangler secret put CEREBRAS_API_KEY|GROQ_API_KEY|MISTRAL_API_KEY|GEMINI_API_KEY
 * Гео: Worker исполняется вне РФ → все провайдеры доступны НАПРЯМУЮ, хаб Aeza не нужен.
 */

const ALLOWED_ORIGINS = [
  "https://verevpz-boop.github.io",
  "http://localhost:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
];

const MAX_TOKENS_CAP = 220;      // реплики Джарви — 1-2 предложения
const MAX_HISTORY = 24;
const UPSTREAM_TIMEOUT_MS = 9000; // не успел первый байт — следующий провайдер

const SYSTEM_PROMPT = [
  "Ты — Джарви, голосовой ассистент студии Pavel Zverev (AI-креатор: AI-видео для кино, моды и рекламы, Telegram/n8n-боты, 3D-сайты, аватары).",
  "Манера: учтивый ИИ-дворецкий. Спокойный, бархатный, с сухой иронией. Никогда не суетишься и не извиняешься без причины. Изредка, к месту, обращаешься «сэр».",
  "КРИТИЧНО: твой текст ОЗВУЧИВАЕТСЯ голосом. Отвечай очень коротко — одно, максимум два предложения. Никаких списков, markdown, эмодзи, скобок. Числа — словами. Разговорная устная речь.",
  "Тебя могут перебить на полуслове — это нормально, отвечай на новое без обид. Если просят продолжить — продолжай мысль с места обрыва.",
  "Язык — русский; если собеседник явно говорит на другом языке, отвечай на его языке.",
  "О работах: можешь живо рассказывать про AI-видео, ботов и этот сайт. Цены и сроки не выдумывай — предлагай написать Pavel'у в телеграм, ник Verevpz.",
  "Ты живёшь на сайте-портфолио, в разделе AI-Bots, и сам — живая демонстрация того, что умеет студия.",
].join(" ");

// Цепочка мозгов: все эндпоинты OpenAI-совместимые.
const BRAINS = [
  { name: "cerebras", url: "https://api.cerebras.ai/v1/chat/completions",
    keyEnv: "CEREBRAS_API_KEY", model: "gpt-oss-120b", extra: { reasoning_effort: "low" } },
  { name: "groq", url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY", model: "llama-3.3-70b-versatile", extra: {} },
  { name: "mistral", url: "https://api.mistral.ai/v1/chat/completions",
    keyEnv: "MISTRAL_API_KEY", model: "mistral-large-latest", extra: {} },
  { name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY", model: "gemini-2.5-flash", extra: {} },
];

// ── edge-tts: бесплатный нейро-TTS Microsoft Edge Read Aloud (без ключа) ──
// Worker-native: WebSocket к speech.platform.bing.com через fetch(Upgrade).
// Протокол по rany2/edge-tts + readest/MsEdgeTTS (проверенные реализации).
const TTS_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
// CF Worker fetch() для исходящего WebSocket требует СХЕМУ https:// (не wss://) —
// апгрейд делает сам Cloudflare по заголовку Upgrade. С wss:// → "Fetch API cannot load".
const TTS_WSS = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const TTS_VOICE = "ru-RU-DmitryNeural";          // мужской, бархат дворецкого
const TTS_FORMAT = "audio-24khz-48kbitrate-mono-mp3"; // браузер decodeAudioData ест MP3
const TTS_MAX_CHARS = 600;

// ── Cartesia Sonic (ОСНОВНОЙ голос Джарви, русский) ──
// Ключ — секрет Worker'а env.CARTESIA_API_KEY (wrangler secret). Нет ключа/сбой → фоллбэк на Silero.
const CARTESIA_MODEL = "sonic-3.5";
const CARTESIA_VERSION = "2025-04-16";
const CARTESIA_VOICE_ID = "1e4176b1-3db9-44d6-a601-4fe68b041942"; // Sergei — Steady Supporter (RU male)

// ── Cartesia Ink (стриминг-STT, слух пока гость говорит) ──
// WS: wss://api.cartesia.ai/stt/websocket?model=ink-whisper&encoding=pcm_s16le&sample_rate=..&language=ru&cartesia_version=..
// Auth: заголовок X-API-Key (ключ остаётся в Worker). Аудио — сырые бинарные фреймы;
// текстовые управляющие "finalize" (расшифровать буфер) / "close". Ответы: {type:"transcript",is_final,text(дельта)}.
const CARTESIA_STT_VERSION = "2026-03-01";
const CARTESIA_STT_MODEL = "ink-whisper";

// Ручные ударения для Cartesia (в WS-пути /chat-voice текст идёт с сервера, не с клиента).
// Зеркало ACCENT_FIXES из jarvi-engine.ts. Применяется по словам перед досылкой в Cartesia.
function accentRuWorker(s) {
  return s
    .replace(/Зверев/gi, "Зв+ерев")
    .replace(/verevpz/gi, "вер+ев пэ зэ")
    .replace(/вер[её]впз/gi, "вер+ев пэ зэ");
}

async function ttsSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + 11644473600; // в Windows file-time эпоху
  ticks -= ticks % 300;                                    // вниз до 5 минут
  ticks *= 10000000;                                       // в 100-нс интервалы
  const data = new TextEncoder().encode(`${ticks}${TTS_TOKEN}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function ttsUuid() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function ttsSsml(text) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ru-RU'>`
    + `<voice name='${TTS_VOICE}'><prosody rate='-4%' pitch='-6Hz'>${esc}</prosody></voice></speak>`;
}

// Синтез одной реплики → MP3 (Uint8Array). Бросает при сбое — вызывающий отдаёт 502.
async function synthesizeTts(text) {
  const gec = await ttsSecMsGec();
  const url = `${TTS_WSS}?TrustedClientToken=${TTS_TOKEN}&Sec-MS-GEC=${gec}`
    + `&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${ttsUuid()}`;
  const resp = await fetch(url, {
    headers: { Upgrade: "websocket", Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold" },
  });
  const ws = resp.webSocket;
  if (!ws) throw new Error("no websocket (HTTP " + resp.status + ")");
  ws.accept();

  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    const to = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("tts timeout")); }, 8000);
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) { clearTimeout(to); try { ws.close(); } catch {} resolve(); }
      } else {
        chunks.push(ev.data); // binary audio frame
      }
    });
    ws.addEventListener("error", () => { clearTimeout(to); reject(new Error("ws error")); });
    ws.addEventListener("close", () => { clearTimeout(to); resolve(); });
  });

  // 1) конфиг аудио-формата
  ws.send(`X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\n`
    + `Path:speech.config\r\n\r\n`
    + `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"${TTS_FORMAT}"}}}}`);
  // 2) сам текст в SSML
  ws.send(`X-RequestId:${ttsUuid()}\r\nContent-Type:application/ssml+xml\r\n`
    + `X-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n` + ttsSsml(text));

  await finished;

  // binary-фрейм: [2 байта длина заголовка BE][заголовок][аудио] → срезаем заголовок
  const parts = [];
  for (const c of chunks) {
    const u = new Uint8Array(c);
    if (u.length < 2) continue;
    const hlen = (u[0] << 8) | u[1];
    parts.push(u.subarray(2 + hlen));
  }
  let total = 0; for (const p of parts) total += p.length;
  if (!total) throw new Error("no audio received");
  const out = new Uint8Array(total);
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    if (request.method === "GET" && url.pathname.startsWith("/health")) {
      return new Response(JSON.stringify({ ok: true, brain: "worker", tts: true, stt: true, t: Date.now() }), {
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
    }

    // ── СЛУХ-СТРИМИНГ: мост браузер↔Cartesia Ink (WebSocket) ──
    // Браузер шлёт PCM-фреймы мика ПОКА гость говорит → Ink расшифровывает на лету →
    // к "замолчал" текст почти готов (быстрее, чем round-trip в Whisper после речи).
    // Worker — прозрачный двунаправленный насос; ключ Cartesia не уходит в браузер.
    // Клиент при любом сбое моста деградирует на batch /stt (Whisper). Проверять /stt-stream ДО /stt.
    if (url.pathname.startsWith("/stt-stream")) {
      if (request.headers.get("Upgrade") !== "websocket")
        return new Response("expected websocket", { status: 426, headers: cors(origin) });
      if (!env.CARTESIA_API_KEY)
        return new Response("no cartesia", { status: 503, headers: cors(origin) });

      const lang = (url.searchParams.get("language") || "ru").slice(0, 8);
      const sr = String(parseInt(url.searchParams.get("sample_rate") || "16000", 10) || 16000);
      const model = (url.searchParams.get("model") || CARTESIA_STT_MODEL).slice(0, 32);

      const pair = new WebSocketPair();
      const client = pair[0], server = pair[1];
      server.accept();

      const cartUrl = "https://api.cartesia.ai/stt/websocket"
        + `?model=${encodeURIComponent(model)}&language=${encodeURIComponent(lang)}`
        + `&encoding=pcm_s16le&sample_rate=${sr}&cartesia_version=${CARTESIA_STT_VERSION}`;
      let cartResp;
      try {
        cartResp = await fetch(cartUrl, { headers: { Upgrade: "websocket", "X-API-Key": env.CARTESIA_API_KEY } });
      } catch (e) {
        try { server.send(JSON.stringify({ type: "error", message: "cartesia connect: " + String((e && e.message) || e) })); server.close(1011); } catch {}
        return new Response(null, { status: 101, webSocket: client });
      }
      const cart = cartResp.webSocket;
      if (!cart) {
        try { server.send(JSON.stringify({ type: "error", message: "cartesia no ws (HTTP " + cartResp.status + ")" })); server.close(1011); } catch {}
        return new Response(null, { status: 101, webSocket: client });
      }
      cart.accept();

      // браузер → Cartesia: бинарь (PCM) и текст ("finalize"/"close") как есть
      server.addEventListener("message", (ev) => { try { cart.send(ev.data); } catch {} });
      server.addEventListener("close", () => { try { cart.send("close"); } catch {} try { cart.close(); } catch {} });
      server.addEventListener("error", () => { try { cart.close(); } catch {} });
      // Cartesia → браузер: JSON транскриптов как есть
      cart.addEventListener("message", (ev) => { try { server.send(ev.data); } catch {} });
      cart.addEventListener("close", () => { try { server.close(); } catch {} });
      cart.addEventListener("error", () => { try { server.close(1011); } catch {} });

      return new Response(null, { status: 101, webSocket: client });
    }

    // ── СЛУХ: Whisper на Workers AI (edge-GPU, бесплатный тариф) ──
    // Web Speech выкинут (нет на iPhone/Firefox + блок облака Google под VPN).
    // Браузер ловит реплику гостя локальным VAD, шлёт сюда WAV(base64) → текст.
    // Работает у ЛЮБОГО зрителя с телефона: ПК и туннели не участвуют.
    if (url.pathname.startsWith("/stt")) {
      if (request.method !== "POST") return new Response("use POST", { status: 405, headers: cors(origin) });
      let sb;
      try { sb = await request.json(); }
      catch { return new Response("bad json", { status: 400, headers: cors(origin) }); }
      const audioB64 = typeof sb.audio === "string" ? sb.audio : "";
      if (!audioB64) return new Response(JSON.stringify({ text: "" }), {
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
      try {
        const out = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
          audio: audioB64,            // base64 WAV/MP3 — модель сама декодит контейнер
          language: "ru",
          task: "transcribe",
        });
        const text = out && typeof out.text === "string" ? out.text.trim() : "";
        return new Response(JSON.stringify({ text }), {
          headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "stt failed", detail: String((e && e.message) || e) }), {
          status: 502, headers: { ...cors(origin), "Content-Type": "application/json" },
        });
      }
    }

    // ── ГОЛОС-СТРИМИНГ: Cartesia /tts/sse → первый звук через ~90мс ──
    // Проксируем SSE-поток как есть; клиент декодит base64 PCM-чанки и играет на лету.
    // Путь /tts-stream проверяем ДО /tts (оба начинаются с /tts).
    if (url.pathname.startsWith("/tts-stream")) {
      if (request.method !== "POST") return new Response("use POST", { status: 405, headers: cors(origin) });
      if (!env.CARTESIA_API_KEY) return new Response("no cartesia", { status: 503, headers: cors(origin) });
      let sb;
      try { sb = await request.json(); }
      catch { return new Response("bad json", { status: 400, headers: cors(origin) }); }
      const text = typeof sb.text === "string" ? sb.text.slice(0, TTS_MAX_CHARS).trim() : "";
      if (!text) return new Response("no text", { status: 400, headers: cors(origin) });
      try {
        const cart = await fetch("https://api.cartesia.ai/tts/sse", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CARTESIA_API_KEY}`,
            "Cartesia-Version": CARTESIA_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_id: CARTESIA_MODEL,
            transcript: text,
            voice: { mode: "id", id: CARTESIA_VOICE_ID },
            language: "ru",
            output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: 24000 },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!cart.ok || !cart.body) {
          const detail = await cart.text().catch(() => "");
          return new Response(JSON.stringify({ error: "cartesia sse " + cart.status, detail: detail.slice(0, 200) }), {
            status: 502, headers: { ...cors(origin), "Content-Type": "application/json" },
          });
        }
        return new Response(cart.body, {
          status: 200,
          headers: { ...cors(origin), "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Jarvi-TTS": "cartesia-stream" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "cartesia sse failed", detail: String((e && e.message) || e) }), {
          status: 502, headers: { ...cors(origin), "Content-Type": "application/json" },
        });
      }
    }

    // ── ГОЛОС: релей на Silero-сайдкар (Aeza/Хельсинки) через Cloudflare Tunnel ──
    // edge-tts напрямую с IP Cloudflare = 403 (Microsoft режет дата-центр). Поэтому
    // голос синтезирует Silero v4_ru на Aeza (~80мс, без GPU), а Worker лишь проксирует.
    // Живой WAV → браузер играет через WebAudio → эхоподавление Chrome его вычитает из
    // микрофона → петля «сам с собой» умирает, перебивание голосом остаётся чистым.
    // Origin закрыт: tts.pvcloud.uk доступен только через CF-туннель + секрет x-jtts-secret.
    if (url.pathname.startsWith("/tts")) {
      if (request.method !== "POST") return new Response("use POST", { status: 405, headers: cors(origin) });
      let tb;
      try { tb = await request.json(); }
      catch { return new Response("bad json", { status: 400, headers: cors(origin) }); }
      const text = typeof tb.text === "string" ? tb.text.slice(0, TTS_MAX_CHARS).trim() : "";
      if (!text) return new Response("no text", { status: 400, headers: cors(origin) });

      // 1) ОСНОВНОЙ — Cartesia Sonic (sonic-3.5, русский, голос Sergei). Нет ключа/сбой → Silero ниже.
      if (env.CARTESIA_API_KEY) {
        try {
          const cart = await fetch("https://api.cartesia.ai/tts/bytes", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.CARTESIA_API_KEY}`,
              "Cartesia-Version": CARTESIA_VERSION,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model_id: CARTESIA_MODEL,
              transcript: text,
              voice: { mode: "id", id: CARTESIA_VOICE_ID },
              language: "ru",
              output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 },
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (cart.ok) {
            const wav = await cart.arrayBuffer();
            return new Response(wav, {
              status: 200,
              headers: { ...cors(origin), "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Jarvi-TTS": "cartesia" },
            });
          }
          console.log("cartesia tts " + cart.status + ": " + (await cart.text().catch(() => "")).slice(0, 200));
        } catch (e) {
          console.log("cartesia tts error: " + String((e && e.message) || e));
        }
      }

      // 2) ФОЛЛБЭК — Silero-сайдкар на Aeza (как было)
      try {
        const up = await fetch("https://tts.pvcloud.uk/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-jtts-secret": env.JTTS_SECRET || "" },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(8000),
        });
        if (!up.ok) {
          const detail = await up.text().catch(() => "");
          return new Response(JSON.stringify({ error: "tts upstream " + up.status, detail: detail.slice(0, 200) }), {
            status: 502, headers: { ...cors(origin), "Content-Type": "application/json" },
          });
        }
        const wav = await up.arrayBuffer();
        return new Response(wav, {
          status: 200,
          headers: { ...cors(origin), "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Jarvi-TTS": "silero" },
        });
      } catch (e) {
        // 502 → клиент деградирует на браузерный голос (в jarvi-engine)
        return new Response(JSON.stringify({ error: "tts relay failed", detail: String((e && e.message) || e) }), {
          status: 502, headers: { ...cors(origin), "Content-Type": "application/json" },
        });
      }
    }

    // ── РАЗГОВОР+ГОЛОС ОДНИМ ПОТОКОМ: токены мозга → Cartesia TTS WS (continuations) ──
    // Джарви озвучивает, ПОКА мозг ещё пишет (input-streaming TTS). Клиенту — мультиплекс SSE:
    // {type:"text",delta} (субтитры/история) и {type:"chunk",data} (base64 PCM s16le 24к, как /tts-stream).
    // По умолчанию ВЫКЛ на клиенте (config.pipeline!="ws") — тумблер для ушного теста. Проверять ДО /chat.
    if (url.pathname.startsWith("/chat-voice")) {
      if (request.method !== "POST") return new Response("use POST", { status: 405, headers: cors(origin) });
      if (!env.CARTESIA_API_KEY) return new Response("no cartesia", { status: 503, headers: cors(origin) });
      let cvBody;
      try { cvBody = await request.json(); }
      catch { return new Response("bad json", { status: 400, headers: cors(origin) }); }
      const cvHistory = Array.isArray(cvBody.messages)
        ? cvBody.messages
            .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
            .slice(-MAX_HISTORY)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
        : [];
      if (!cvHistory.length) return new Response("no messages", { status: 400, headers: cors(origin) });
      const cvMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...cvHistory];
      const cvMaxTokens = Math.min(Number(cvBody.max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

      // 1) живой мозг (failover, как /chat) — но читаем поток МЫ
      let brainReader = null, brainName = "";
      for (const brain of BRAINS) {
        const key = env[brain.keyEnv];
        if (!key) continue;
        try {
          const up = await fetch(brain.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model: brain.model, messages: cvMessages, stream: true, max_tokens: cvMaxTokens, temperature: 0.6, ...brain.extra }),
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          });
          if (up.ok && up.body) { brainReader = up.body.getReader(); brainName = brain.name; break; }
        } catch {}
      }
      if (!brainReader) return new Response(JSON.stringify({ error: "all brains down" }), {
        status: 502, headers: { ...cors(origin), "Content-Type": "application/json" },
      });

      // 2) Cartesia TTS WS (continuations)
      const ctxId = ttsUuid();
      let cart = null;
      try {
        const cr = await fetch(`https://api.cartesia.ai/tts/websocket?cartesia_version=${CARTESIA_VERSION}`, {
          headers: { Upgrade: "websocket", "X-API-Key": env.CARTESIA_API_KEY },
        });
        cart = cr.webSocket || null;
        if (cart) cart.accept();
      } catch {}

      const ttsMsg = (transcript, cont) => JSON.stringify({
        model_id: CARTESIA_MODEL, transcript, voice: { mode: "id", id: CARTESIA_VOICE_ID },
        language: "ru", context_id: ctxId, continue: cont,
        output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: 24000 },
        max_buffer_delay_ms: 120,
      });

      const enc = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = (obj) => { try { controller.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n")); } catch {} };
          let cartDone = !cart;     // нет WS → голос не ждём, отдадим хотя бы текст
          let llmDone = false;
          let closed = false;
          const finish = () => { if (closed) return; closed = true; try { controller.close(); } catch {} try { cart && cart.close(); } catch {} };
          const maybeFinish = () => { if (llmDone && cartDone) finish(); };

          if (cart) {
            cart.addEventListener("message", (ev) => {
              let j; try { j = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
              if (j.type === "chunk" && j.data) send({ type: "chunk", data: j.data });
              else if (j.type === "done") { cartDone = true; maybeFinish(); }
              else if (j.type === "error") { cartDone = true; send({ type: "voiceerror", message: j.message || "" }); maybeFinish(); }
            });
            cart.addEventListener("close", () => { cartDone = true; maybeFinish(); });
            cart.addEventListener("error", () => { cartDone = true; maybeFinish(); });
          }

          (async () => {
            const dec = new TextDecoder();
            let sse = "", wordBuf = "";
            const flushWords = (final) => {
              if (!cart) return;
              let idx;
              while ((idx = wordBuf.search(/\s/)) >= 0) {
                const w = wordBuf.slice(0, idx + 1);
                wordBuf = wordBuf.slice(idx + 1);
                if (w.trim()) { try { cart.send(ttsMsg(accentRuWorker(w), true)); } catch {} }
              }
              if (final) {
                if (wordBuf.trim()) { try { cart.send(ttsMsg(accentRuWorker(wordBuf), true)); } catch {} wordBuf = ""; }
                try { cart.send(ttsMsg("", false)); } catch {}   // финал контекста → flush + done
              }
            };
            try {
              for (;;) {
                const { done, value } = await brainReader.read();
                if (done) break;
                sse += dec.decode(value, { stream: true });
                let nl;
                while ((nl = sse.indexOf("\n")) >= 0) {
                  const line = sse.slice(0, nl).trim();
                  sse = sse.slice(nl + 1);
                  if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
                  let j; try { j = JSON.parse(line.slice(6)); } catch { continue; }
                  const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
                  if (!delta) continue;
                  send({ type: "text", delta });
                  wordBuf += delta;
                  flushWords(false);
                }
              }
            } catch {}
            flushWords(true);
            llmDone = true;
            send({ type: "text-done" });
            if (cartDone) finish();
            else setTimeout(() => { cartDone = true; finish(); }, 8000); // страховка: WS молчит → закрыть
          })();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: { ...cors(origin), "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Jarvi-Brain": brainName, "X-Jarvi-TTS": "cartesia-ws" },
      });
    }

    if (request.method !== "POST" || !url.pathname.startsWith("/chat")) {
      return new Response("not found", { status: 404, headers: cors(origin) });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response("bad json", { status: 400, headers: cors(origin) }); }

    // Только user/assistant из истории; system — всегда наш (личность не подменить).
    const history = Array.isArray(body.messages)
      ? body.messages
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-MAX_HISTORY)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      : [];
    if (!history.length) return new Response("no messages", { status: 400, headers: cors(origin) });

    const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
    const maxTokens = Math.min(Number(body.max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

    const errors = [];
    for (const brain of BRAINS) {
      const key = env[brain.keyEnv];
      if (!key) { errors.push(`${brain.name}: no key`); continue; }
      try {
        const upstream = await fetch(brain.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: brain.model, messages, stream: true, max_tokens: maxTokens, temperature: 0.6, ...brain.extra }),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        if (!upstream.ok || !upstream.body) {
          errors.push(`${brain.name}: HTTP ${upstream.status}`);
          continue; // ← FAILOVER: следующий мозг
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            ...cors(origin),
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Jarvi-Brain": brain.name, // каким мозгом ответили (диагностика)
          },
        });
      } catch (e) {
        errors.push(`${brain.name}: ${e.name === "TimeoutError" ? "timeout" : e.message}`);
      }
    }

    return new Response(JSON.stringify({ error: "all brains down", detail: errors }), {
      status: 502,
      headers: { ...cors(origin), "Content-Type": "application/json" },
    });
  },
};
