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
      return new Response(JSON.stringify({ ok: true, brain: "worker", tts: false, t: Date.now() }), {
        headers: { ...cors(origin), "Content-Type": "application/json" },
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
