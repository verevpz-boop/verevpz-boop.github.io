/**
 * Cloudflare Worker — LLM proxy for the Signature Head satellite.
 *
 * Why it exists: a static GitHub Pages site cannot call the LLM with a secret
 * key without exposing it in the browser. This Worker holds the key server-side
 * and forwards to Cerebras (ultra-fast, free tier), streaming tokens back so the
 * head starts speaking with minimal latency.
 *
 * Deploy (Pavel, with his own Cloudflare account):
 *   1. npm i -g wrangler && wrangler login
 *   2. wrangler secret put CEREBRAS_API_KEY   (paste the Cerebras key)
 *   3. wrangler deploy
 *   4. Put the resulting *.workers.dev URL into the site (env NEXT_PUBLIC_HEAD_PROXY).
 *
 * Security: key never leaves the Worker. Origin allowlist below blocks other sites.
 */

const ALLOWED_ORIGINS = [
  "https://verevpz-boop.github.io",   // real GitHub Pages origin
  "http://localhost:3000",            // local dev
  "http://localhost:4321",            // local static preview
];

const UPSTREAM = "https://api.cerebras.ai/v1/chat/completions";
const MODEL = "llama-3.3-70b"; // fast Cerebras model; swap if needed

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(origin) });
    }
    if (request.method !== "POST") {
      return new Response("POST only", { status: 405, headers: cors(origin) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("bad json", { status: 400, headers: cors(origin) });
    }

    // Accept either {messages:[...]} or {message:"...", system?:"..."}
    const messages = body.messages || [
      ...(body.system ? [{ role: "system", content: body.system }] : []),
      { role: "user", content: String(body.message || "") },
    ];

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: body.model || MODEL,
        messages,
        stream: true,
        max_tokens: body.max_tokens || 400,
        temperature: body.temperature ?? 0.6,
      }),
    });

    // Stream the SSE response straight back to the browser.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  },
};
