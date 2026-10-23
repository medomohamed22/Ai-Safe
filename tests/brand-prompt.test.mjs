import assert from 'node:assert/strict';
import { brandPrompt, DEFAULT_BRAND } from '../src/lib/brand.ts';
import { extractCode, sanitizeGeneratedCode, EMBEDDED_IMAGE_PLACEHOLDER } from '../src/lib/prompts.ts';

// Regression test for the on-device incident: the saved brand logo (a base64
// data URL) used to be JSON-serialized into every generation prompt. The
// model copied the blob into the code — bloated, broken builds and a wall of
// base64 in the stream. The logo now travels only as an attached image.
const LOGO = `data:image/png;base64,${'QUJD'.repeat(2000)}`;
const brand = { ...DEFAULT_BRAND, enabled: true, name: 'AppHub', primary: '#123456', logo: LOGO };
const prompt = brandPrompt(brand);
assert.ok(prompt.includes('SAVED BRAND IDENTITY'), 'the identity still reaches the model');
assert.ok(prompt.includes('#123456') && prompt.includes('AppHub'), 'palette and name are in the prompt');
assert.ok(!prompt.includes('data:image'), 'the prompt text contains no data URL');
assert.ok(!prompt.includes('QUJD'), 'the prompt text contains no base64 payload');
assert.ok(prompt.includes('never with a data URL'), 'the model is told to draw the logo, not paste it');
assert.equal(brandPrompt({ ...brand, enabled: false }), '', 'a disabled brand stays silent');

const blob = `data:image/png;base64,${'QUJD'.repeat(500)}`;
const dirty = `export default function App(){return <main><img src="${blob}" alt="logo" /><h1>Hi</h1></main>}`;
const clean = sanitizeGeneratedCode(dirty);
assert.ok(!clean.includes('QUJD'), 'long base64 data URIs are stripped from generated code');
assert.ok(clean.includes(EMBEDDED_IMAGE_PLACEHOLDER), 'the stripped image becomes the small placeholder');
const short = 'export default function App(){return <img src="data:image/svg+xml,%3Csvg%3E" alt="" />}';
assert.equal(sanitizeGeneratedCode(short), short, 'short legitimate data URIs are untouched');
const fenced = extractCode('```jsx\n' + dirty + '\n```');
assert.ok(!fenced.includes('QUJD') && fenced.includes(EMBEDDED_IMAGE_PLACEHOLDER), 'extractCode sanitizes fenced replies');
console.log('PASS: brand prompt — the logo never enters the prompt text; generated code is sanitized of base64 blobs.');
