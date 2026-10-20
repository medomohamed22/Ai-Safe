// Reports whether this deployment offers the hosted demo mode.
// The demo key itself never leaves the server: api/proxy.js injects it for
// flagged demo requests to api.meta.ai only. The env var is the switch.
export const config = { runtime: 'edge' };

export default async function handler() {
  const demo = typeof process !== 'undefined' && !!process.env.META_MODEL_API_KEY;
  return new Response(JSON.stringify({ demo, provider: 'meta', model: 'muse-spark-1.3' }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
