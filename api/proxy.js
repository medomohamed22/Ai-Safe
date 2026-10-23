// Optional CORS pass-through proxy (Vercel Edge Function).
// Some AI providers block direct browser requests (CORS). When "Use proxy" is enabled
// for a provider in Settings, requests are forwarded through here.
// Nothing is stored or logged: the API key travels in the request headers only.

export const config = { runtime: 'edge' };

// Only these hosts can be reached through the proxy (prevents an open proxy).
const ALLOWED_HOSTS = [
  'api.meta.ai',
  'openrouter.ai',
  'api.llama.com',
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'api.groq.com',
  'api.together.xyz',
  'api.deepinfra.com',
  'api.mistral.ai',
  'api.figma.com',
  'is.gd',
];

const FORWARD_HEADERS = ['authorization', 'content-type', 'accept', 'x-goog-api-key', 'http-referer', 'x-title', 'x-figma-token', 'x-s2ui-demo'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': FORWARD_HEADERS.join(','),
};

function json(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

// Hosted demo mode (best-effort, per-instance): flagged demo requests are
// limited per visitor IP so a shared demo key cannot be drained by one visitor.
const DEMO_WINDOW_MS = 10 * 60 * 1000;
const DEMO_MAX = 40;
// Credit guardrail (item 9): a demo generation is also capped in output size,
// so one visitor cannot burn the shared credit on a single huge completion.
const DEMO_MAX_TOKENS = 8000;
const demoHits = new Map();
function demoSlot(ip) {
  const now = Date.now();
  const hits = (demoHits.get(ip) || []).filter((t) => now - t < DEMO_WINDOW_MS);
  if (hits.length >= DEMO_MAX) { demoHits.set(ip, hits); return false; }
  hits.push(now);
  demoHits.set(ip, hits);
  return true;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const raw = new URL(req.url).searchParams.get('url');
  let target;
  try {
    target = new URL(raw || '');
  } catch {
    return json(400, 'Missing or invalid ?url=');
  }
  const allowed = ALLOWED_HOSTS.some((h) => target.hostname === h || target.hostname.endsWith('.' + h));
  if (target.protocol !== 'https:' || !allowed) {
    return json(403, `Host not allowed by proxy: ${target.hostname}. Add it to ALLOWED_HOSTS in api/proxy.js`);
  }

  const headers = new Headers();
  for (const k of FORWARD_HEADERS) {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  }

  // Demo key injection: only for flagged demo requests to api.meta.ai, only
  // when the visitor sent no key of their own, and only when the deployment
  // owner configured META_MODEL_API_KEY. The key never reaches the browser.
  let injectedDemo = false;
  if (req.headers.get('x-s2ui-demo') === '1' && target.hostname === 'api.meta.ai' && !headers.has('authorization')) {
    const demoKey = process.env.META_MODEL_API_KEY;
    if (!demoKey) return json(503, 'Demo mode is not enabled on this deployment. Add your own Meta Model API key in Settings.');
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (!demoSlot(ip)) return json(429, 'Demo rate limit reached for now. Add your own Meta Model API key in Settings for unrestricted use.');
    headers.set('authorization', `Bearer ${demoKey}`);
    injectedDemo = true;
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  let body = hasBody ? await req.arrayBuffer() : undefined;
  // Demo-only clamp: shrink an oversized token budget before it goes upstream.
  // Anything that is not plain JSON is forwarded byte for byte.
  if (body && injectedDemo && (headers.get('content-type') || '').includes('json')) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body));
      let changed = false;
      for (const field of ['max_tokens', 'max_output_tokens']) {
        if (typeof parsed[field] === 'number' && parsed[field] > DEMO_MAX_TOKENS) { parsed[field] = DEMO_MAX_TOKENS; changed = true; }
      }
      if (changed) body = new TextEncoder().encode(JSON.stringify(parsed));
    } catch { /* not JSON: forward untouched */ }
  }
  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: req.method,
      headers,
      body,
    });
  } catch (e) {
    return json(502, 'Upstream fetch failed: ' + (e && e.message ? e.message : String(e)));
  }

  const out = new Headers(CORS);
  out.set('content-type', upstream.headers.get('content-type') || 'application/json');
  out.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
