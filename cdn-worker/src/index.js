/**
 * pavel-cdn — бесплатный CDN для видео портфолио поверх Cloudflare R2.
 *
 * Зачем: публичный dev-URL `*.r2.dev` Cloudflare НАМЕРЕННО троттлит (rate-limit,
 * 429, урезанная полоса) и не кэшируется — на мобиле видео захлёбывалось. Этот
 * Worker раздаёт тот же бакет `video` с края сети Cloudflare, с edge-кэшем и
 * поддержкой Range-запросов (перемотка/докачка). Бесплатно: Workers free tier
 * 100k запросов/день + нулевой egress R2.
 *
 * Привязка R2-бакета `video` — в wrangler.toml (binding VIDEO_BUCKET).
 */

// Откуда разрешаем доступ (CORS нужен TikTok-сфере: видео как WebGL-текстуры
// с crossOrigin="anonymous"). При смене домена сайта — добавить сюда.
const ALLOWED_ORIGINS = [
  "https://verevpz-boop.github.io",
  "http://localhost:3000",
  "http://localhost:3100",
];

/** Разобрать HTTP-заголовок Range в R2Range ({offset,length} | {suffix}). */
function parseRange(rangeHeader) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) return undefined;
  const [, startStr, endStr] = m;
  if (startStr === "" && endStr === "") return undefined;
  if (startStr === "") return { suffix: parseInt(endStr, 10) }; // последние N байт
  const offset = parseInt(startStr, 10);
  if (endStr === "") return { offset };
  return { offset, length: parseInt(endStr, 10) - offset + 1 };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    const origin = request.headers.get("Origin");
    const allowOrigin =
      origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges, ETag",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }
    if (!key) {
      return new Response("Not Found", { status: 404, headers: cors });
    }

    const rangeHeader = request.headers.get("Range");
    const cache = caches.default;

    // Полные запросы (без Range) кэшируем на крае сети.
    if (!rangeHeader) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }

    const range = rangeHeader ? parseRange(rangeHeader) : undefined;
    const object = await env.VIDEO_BUCKET.get(key, range ? { range } : undefined);
    if (!object || !object.body) {
      return new Response("Not Found", { status: 404, headers: cors });
    }

    const headers = new Headers(cors);
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    // Сегменты видео неизменны → кэшируем агрессивно.
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    if (request.method === "HEAD") {
      headers.set("Content-Length", String(object.size));
      return new Response(null, { headers });
    }

    if (range && object.range) {
      const offset = object.range.offset ?? 0;
      const length = object.range.length ?? object.size - offset;
      headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
      headers.set("Content-Length", String(length));
      return new Response(object.body, { status: 206, headers });
    }

    headers.set("Content-Length", String(object.size));
    const response = new Response(object.body, { headers });
    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
