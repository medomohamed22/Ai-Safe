import assert from 'node:assert/strict';
import { findImageSlots, imageModelFor, applyImages, MAX_GENERATED_IMAGES } from '../src/lib/imageGen.ts';

const code = `
export default function App() {
  return <div>
    <img src="https://picsum.photos/seed/hero/800/400" alt="Team working in a modern office" />
    <img src="https://picsum.photos/seed/avatar-1/100/100" />
    <div style={{ backgroundImage: 'url(https://placehold.co/600x300)' }} />
    <img src="https://example.com/real-photo.jpg" alt="Keep me" />
    <img src="https://picsum.photos/seed/hero/800/400" alt="Duplicate of the hero" />
  </div>;
}`;

const slots = findImageSlots(code);
assert.equal(slots.length, 3, 'unique placeholder URLs only');
const hero = slots.find((s) => s.url.includes('seed/hero'));
assert.ok(hero.prompt.includes('Team working in a modern office'), 'alt text drives the prompt');
const avatar = slots.find((s) => s.url.includes('avatar'));
assert.ok(avatar.prompt.includes('avatar 1'), 'seed words drive the prompt when alt is missing');
assert.ok(slots.some((s) => s.url.includes('placehold.co')), 'CSS background placeholders are found');
assert.ok(!slots.some((s) => s.url.includes('example.com')), 'real URLs are untouched');
assert.deepEqual(findImageSlots('<div>No images here</div>'), []);

// Provider -> image model mapping
assert.equal(imageModelFor({ type: 'meta', models: [] }), 'muse-image-1.0');
assert.equal(imageModelFor({ type: 'gemini', models: [{ id: 'imagen-3' }] }), null);
assert.equal(imageModelFor({ type: 'openrouter', models: [{ id: 'black-forest-labs/flux-1.1-pro' }] }), 'black-forest-labs/flux-1.1-pro');
assert.equal(imageModelFor({ type: 'openai', models: [{ id: 'gpt-4o' }] }), null);
assert.equal(imageModelFor({ type: 'openai', models: [{ id: 'gpt-image-1' }] }), 'gpt-image-1');
assert.ok(MAX_GENERATED_IMAGES >= 1);

// Substitution replaces every occurrence and leaves other URLs alone
const replaced = applyImages(code, new Map([['https://picsum.photos/seed/hero/800/400', 'data:image/jpeg;base64,XYZ']]));
assert.ok(!replaced.includes('seed/hero'));
assert.equal(replaced.split('data:image/jpeg;base64,XYZ').length - 1, 2, 'both hero occurrences replaced');
assert.ok(replaced.includes('https://example.com/real-photo.jpg'));

console.log('PASS: placeholder detection (img alt/seed prompts, CSS backgrounds, dedupe), provider image-model mapping, and code substitution.');
