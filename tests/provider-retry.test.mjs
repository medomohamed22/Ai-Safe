import assert from 'node:assert/strict';
const store = new Map(); globalThis.localStorage = { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }; globalThis.window = new EventTarget();
const { generate, deadModels, pickDefaultModel } = await import('../src/lib/providers.ts');
const provider = { id: 'test', type: 'openai', name: 'Test', apiKey: 'k', baseUrl: 'https://mock.example/v1', useProxy: false, models: [] };
const okBody = () => new Response(JSON.stringify({ choices: [{ message: { content: 'result' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { headers: { 'content-type': 'application/json' } });
const args = (userText) => ({ provider, model: 'm', system: 's', userText, temperature: .2, signal: new AbortController().signal, onToken: () => {} });

// F5: a transient 500 before any token is retried once, automatically.
let calls = 0;
globalThis.fetch = async () => { calls++; return calls === 1 ? new Response('boom', { status: 500 }) : okBody(); };
assert.equal(await generate(args('retry me')), 'result');
assert.equal(calls, 2);

// F5: a 429 is transient too.
calls = 0;
globalThis.fetch = async () => { calls++; return calls === 1 ? new Response('slow', { status: 429 }) : okBody(); };
assert.equal(await generate(args('rate limited')), 'result');
assert.equal(calls, 2);

// F5: a 400 is NOT retried — it is a request problem, not a transient one.
calls = 0;
globalThis.fetch = async () => { calls++; return new Response('bad', { status: 400 }); };
await assert.rejects(() => generate(args('bad request')), /could not process/);
assert.equal(calls, 1);

// F2: a 404 marks the model dead for this provider, the default pick skips
// it, and a later successful run with the same model clears the mark.
calls = 0;
globalThis.fetch = async () => { calls++; return new Response('nope', { status: 404 }); };
await assert.rejects(() => generate(args('missing model')), /model was not found/);
assert.equal(calls, 1);
assert.deepEqual(deadModels('test'), ['m']);
assert.equal(pickDefaultModel([{ id: 'm', name: 'm' }, { id: 'ok', name: 'ok', vision: true }], deadModels('test')), 'ok');
assert.equal(pickDefaultModel([{ id: 'm', name: 'm' }], deadModels('test')), 'm'); // never leave the user with no default
globalThis.fetch = async () => okBody();
assert.equal(await generate(args('it came back')), 'result');
assert.deepEqual(deadModels('test'), []);
console.log('PASS provider-retry: transient 429/5xx retried once pre-stream, 400 not retried, 404 marks the model dead, default pick skips dead models, success clears the mark.');
