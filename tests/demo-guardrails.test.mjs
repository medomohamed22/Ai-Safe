import assert from 'node:assert/strict';

// Item 9 (client side): the hosted demo generates at most 2 images per design;
// a visitor's own key keeps the full 4. The images endpoint is stubbed.
let imageCalls = 0;
globalThis.fetch = async () => {
  imageCalls++;
  return new Response(JSON.stringify({ data: [{ url: 'https://images.example.test/gen.png' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const { enhanceCodeWithImages, DEMO_MAX_GENERATED_IMAGES, MAX_GENERATED_IMAGES } = await import('../src/lib/imageGen.ts');

const code = `export default function App(){return <div>
  <img src="https://picsum.photos/seed/a/100/100" />
  <img src="https://picsum.photos/seed/b/100/100" />
  <img src="https://picsum.photos/seed/c/100/100" />
  <img src="https://picsum.photos/seed/d/100/100" />
</div>;}`;
const base = { id: 'meta', type: 'meta', name: 'Meta', apiKey: 'k', baseUrl: 'https://api.meta.ai/v1', useProxy: false, models: [] };

imageCalls = 0;
const demoOut = await enhanceCodeWithImages(code, { ...base, demo: true });
assert.equal(imageCalls, DEMO_MAX_GENERATED_IMAGES, 'demo provider is capped at 2 images');
assert.equal(DEMO_MAX_GENERATED_IMAGES, 2);

imageCalls = 0;
await enhanceCodeWithImages(code, { ...base, demo: false });
assert.equal(imageCalls, MAX_GENERATED_IMAGES, 'own-key provider keeps the full image budget');
assert.equal(MAX_GENERATED_IMAGES, 4);
assert.ok(demoOut.includes('images.example.test/gen.png'), 'generated images still land in the code');
console.log('demo-guardrails tests passed.');
