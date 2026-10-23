import assert from 'node:assert/strict';

// localStorage shim so the short-link cache is testable in node.
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { shortenUrl } = await import('../src/lib/shorten.ts');
const LONG = 'https://sketch2ui-app.vercel.app/#app=abc123snapshot';
let calls = 0;
const okFetch = async (url) => { calls++; assert.ok(String(url).startsWith('/api/proxy?url='), 'goes through the site proxy'); assert.ok(decodeURIComponent(String(url)).includes('is.gd/create.php'), 'targets the is.gd API'); return { ok: true, text: async () => 'https://is.gd/AbC123\n' }; };
assert.equal(await shortenUrl(LONG, okFetch), 'https://is.gd/AbC123');
assert.equal(calls, 1);
assert.equal(await shortenUrl(LONG, okFetch), 'https://is.gd/AbC123', 'the second call is served from the cache');
assert.equal(calls, 1, 'cache hit — no second shortener call');
const OTHER = 'https://sketch2ui-app.vercel.app/#app=different';
assert.equal(await shortenUrl(OTHER, async () => ({ ok: false, text: async () => '' })), null, 'HTTP failure returns null');
assert.equal(await shortenUrl(OTHER, async () => ({ ok: true, text: async () => 'Error: too many requests' })), null, 'a non-short-URL body returns null');
assert.equal(await shortenUrl(OTHER, async () => { throw new Error('network'); }), null, 'a network throw returns null');
console.log('PASS: short links — is.gd via the proxy, validated, cached per snapshot, honest null on failure.');
