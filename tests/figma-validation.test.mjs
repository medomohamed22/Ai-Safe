import assert from 'node:assert/strict';
import { parseFigmaUrl } from '../src/lib/figma.ts';

// P2-03: Figma input validation must be friendly and classified — the raw
// "Failed to construct 'URL'" TypeError was the reported bug.
assert.throws(() => parseFigmaUrl(''), /Paste a Figma frame link first/);
assert.throws(() => parseFigmaUrl('   '), /Paste a Figma frame link first/);
assert.throws(() => parseFigmaUrl('not a url'), /does not look like a valid URL/);
assert.throws(() => parseFigmaUrl('https://example.com/design/abc?node-id=1-2'), /HTTPS Figma frame URL/);
assert.throws(() => parseFigmaUrl('http://www.figma.com/design/abc123?node-id=1-2'), /HTTPS Figma frame URL/);
assert.throws(() => parseFigmaUrl('https://www.figma.com/design/abc123'), /node-id/);
assert.deepEqual(parseFigmaUrl('https://www.figma.com/design/AbC-123/My-Frame?node-id=42-7'), { key: 'AbC-123', id: '42:7' });
console.log('figma-validation tests passed.');
