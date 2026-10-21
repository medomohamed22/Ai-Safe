import assert from 'node:assert/strict';

// Mock the upstream fetch before importing the handlers under test.
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), headers: new Headers(init?.headers), body: init?.body });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const proxy = (await import('../api/proxy.js')).default;
const demo = (await import('../api/demo.js')).default;

function proxyReq(target, headers = {}, ip, body = '{}') {
  const h = new Headers(headers);
  if (ip) h.set('x-forwarded-for', ip);
  return new Request(`http://local/api/proxy?url=${encodeURIComponent(target)}`, { method: 'POST', headers: h, body });
}
const CHAT = 'https://api.meta.ai/v1/chat/completions';
const JSON_H = { 'x-s2ui-demo': '1', 'content-type': 'application/json' };

// No env key: demo status off and flagged demo requests are refused.
delete process.env.META_MODEL_API_KEY;
let res = await demo(new Request('http://local/api/demo'));
assert.equal((await res.json()).demo, false);
res = await proxy(proxyReq(CHAT, JSON_H, '1.1.1.1'));
assert.equal(res.status, 503);

// Env key set: demo on, and a flagged keyless request gets the key injected.
process.env.META_MODEL_API_KEY = 'test-demo-key';
res = await demo(new Request('http://local/api/demo'));
const dj = await res.json();
assert.equal(dj.demo, true);
assert.equal(dj.model, 'muse-spark-1.3');
calls.length = 0;
res = await proxy(proxyReq(CHAT, JSON_H, '2.2.2.2'));
assert.equal(res.status, 200);
assert.equal(calls[0].headers.get('authorization'), 'Bearer test-demo-key');

// A visitor's own key is never overridden.
calls.length = 0;
res = await proxy(proxyReq(CHAT, { ...JSON_H, authorization: 'Bearer visitor-key' }, '3.3.3.3'));
assert.equal(res.status, 200);
assert.equal(calls[0].headers.get('authorization'), 'Bearer visitor-key');

// No demo flag: no injection.
calls.length = 0;
res = await proxy(proxyReq(CHAT, { 'content-type': 'application/json' }, '4.4.4.4'));
assert.equal(res.status, 200);
assert.equal(calls[0].headers.get('authorization'), null);

// Other hosts never receive the demo key, even when flagged.
calls.length = 0;
res = await proxy(proxyReq('https://openrouter.ai/api/v1/chat/completions', JSON_H, '5.5.5.5'));
assert.equal(res.status, 200);
assert.equal(calls[0].headers.get('authorization'), null);

// Rate limit: 40 flagged requests pass for one IP, the 41st is blocked.
for (let i = 0; i < 40; i++) {
  res = await proxy(proxyReq(CHAT, JSON_H, '6.6.6.6'));
  assert.equal(res.status, 200);
}
res = await proxy(proxyReq(CHAT, JSON_H, '6.6.6.6'));
assert.equal(res.status, 429);

// Item 9 guardrail: oversized token budgets are clamped for demo requests only.
async function sentJson(call) { const b = call.body; return JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); }
calls.length = 0;
res = await proxy(proxyReq(CHAT, JSON_H, '7.7.7.7', JSON.stringify({ model: 'muse-spark-1.3', max_tokens: 64000 })));
assert.equal(res.status, 200);
assert.equal((await sentJson(calls[0])).max_tokens, 8000, 'demo chat budget clamped to 8000');
calls.length = 0;
res = await proxy(proxyReq(CHAT, JSON_H, '7.7.7.8', JSON.stringify({ max_tokens: 4000 })));
assert.equal((await sentJson(calls[0])).max_tokens, 4000, 'a modest demo budget passes through unchanged');
calls.length = 0;
res = await proxy(proxyReq(CHAT, { ...JSON_H, authorization: 'Bearer <redacted>' }, '7.7.7.9', JSON.stringify({ max_tokens: 64000 })));
assert.equal((await sentJson(calls[0])).max_tokens, 64000, "a visitor's own key is never clamped");
calls.length = 0;
res = await proxy(proxyReq('https://api.meta.ai/v1/responses', JSON_H, '7.7.7.10', JSON.stringify({ max_output_tokens: 32000 })));
assert.equal((await sentJson(calls[0])).max_output_tokens, 8000, 'demo responses budget clamped too');

delete process.env.META_MODEL_API_KEY;
console.log('PASS: demo status endpoint, proxy demo-key injection rules (flag + api.meta.ai host + no visitor key), the demo rate limit, and the item-9 token-budget clamp.');
