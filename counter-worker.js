/**
 * LabelLens shared scan counter — Cloudflare Worker
 *
 * Provides a tiny counter API backed by Cloudflare KV:
 *   GET  /            → { "count": 1847 }        read the current total
 *   POST /            → { "count": 1848 }        increment, then return the new total
 *
 * Deploy instructions are in README-counter.md.
 *
 * DESIGN NOTES
 *
 * 1. KV is eventually consistent and has no atomic increment. Two scans landing in the
 *    same instant can therefore read the same value and both write N+1, losing a count.
 *    For a "labels scanned" vanity total that is an acceptable trade — it undercounts
 *    slightly under heavy concurrency and never breaks. If you ever need an exact
 *    figure, swap KV for a Durable Object, which does give you atomic increments.
 *
 * 2. There is no authentication, because the client is a public static page and any
 *    key shipped to it would be readable anyway. The protections below are about
 *    limiting casual abuse, not preventing a determined attacker — the worst case is
 *    an inflated vanity number, which is why this is proportionate.
 */

// Restrict which sites may call this. Replace with your real deployed origin(s).
// Keep this tight: an open '*' lets any site on the internet inflate your counter.
const ALLOWED_ORIGINS = [
  'https://YOUR-SITE.netlify.app',
  'https://YOUR-USERNAME.github.io',
  'http://localhost:8000',
];

const COUNTER_KEY = 'scan_count';

// Per-IP rate limit on increments. Generous enough for genuine scanning, low enough
// that a script hammering the endpoint gets throttled quickly.
const MAX_INCREMENTS_PER_MINUTE = 20;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

async function isRateLimited(env, ip) {
  if (!ip) return false;
  // Bucket by minute so the key expires naturally and needs no cleanup.
  const minute = Math.floor(Date.now() / 60000);
  const key = `rl:${ip}:${minute}`;
  const current = parseInt((await env.COUNTER.get(key)) || '0', 10);
  if (current >= MAX_INCREMENTS_PER_MINUTE) return true;
  // 120s TTL comfortably outlives the 60s bucket, covering clock skew at boundaries.
  await env.COUNTER.put(key, String(current + 1), { expirationTtl: 120 });
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Reject unknown origins outright rather than relying on the browser to enforce
    // CORS — a non-browser client ignores CORS headers entirely.
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: 'origin not allowed' }, 403, origin);
    }

    try {
      if (request.method === 'GET') {
        const count = parseInt((await env.COUNTER.get(COUNTER_KEY)) || '0', 10);
        return json({ count: Number.isFinite(count) ? count : 0 }, 200, origin);
      }

      if (request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP');
        if (await isRateLimited(env, ip)) {
          // Still return the current total so the client can display something useful
          // rather than treating a throttle as a hard failure.
          const count = parseInt((await env.COUNTER.get(COUNTER_KEY)) || '0', 10);
          return json({ count, throttled: true }, 429, origin);
        }

        const current = parseInt((await env.COUNTER.get(COUNTER_KEY)) || '0', 10);
        const next = (Number.isFinite(current) ? current : 0) + 1;
        await env.COUNTER.put(COUNTER_KEY, String(next));
        return json({ count: next }, 200, origin);
      }

      return json({ error: 'method not allowed' }, 405, origin);
    } catch (err) {
      return json({ error: 'counter unavailable' }, 500, origin);
    }
  },
};
