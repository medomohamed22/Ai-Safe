// Optional CORS pass-through proxy (Vercel Edge Function).
// Some AI providers block direct browser requests (CORS). When "Use proxy" is enabled
// for a provider in Settings, requests are forwarded through here.
// Nothing is stored or logged: the API key travels in the request headers only.

export const config = { runtime: 'edge' };

// Only these hosts can be reached through the proxy (prevents an open proxy).
const ALLOWED_HOSTS = [
  'openrouter.ai',
  'api.llama.com',
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'api.groq.com',
  'api.together.xyz',
  'api.deepinfra.com',
  'api.mistral.ai',
  'api.figma.com',
];

const FORWARD_HEADERS = ['authorization', 'content-type', 'accept', 'x-goog-api-key', 'http-referer', 'x-title', 'x-figma-token'];

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

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
    });
  } catch (e) {
    return json(502, 'Upstream fetch failed: ' + (e && e.message ? e.message : String(e)));
  }

  const out = new Headers(CORS);
  out.set('content-type', upstream.headers.get('content-type') || 'application/json');
  out.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
