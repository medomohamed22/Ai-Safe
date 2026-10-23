import assert from 'node:assert/strict';
import { extractSiteBrand, siteBrandPatch, designTokens, serializeDesignSystem, parseDesignSystemFile, brandBoardHtml } from '../src/lib/brandImport.ts';
import { DEFAULT_BRAND } from '../src/lib/brand.ts';

const html = `<html><head><title>Acme Store | Shop</title><meta name="theme-color" content="#0ea5e9">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Inter&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif;color:#111827;background:#f9fafb}.btn{background:#0ea5e9;color:#ffffff}.muted{color:#6b7280}.sale{color:#dc2626;background:#0ea5e9}</style></head>
<body><div style="background:#0ea5e9;border-color:#0284c7"></div></body></html>`;

const site = extractSiteBrand(html);
assert.equal(site.name, 'Acme Store');
assert.equal(site.colors[0], '#0ea5e9', 'theme-color leads the palette');
assert.ok(site.colors.includes('#dc2626') && site.colors.includes('#111827'), 'declared colors are collected');
assert.ok(site.fonts.includes('Cairo') && site.fonts.includes('Inter'), 'Google Fonts families are extracted');
const patch = siteBrandPatch(site);
assert.equal(patch.primary, '#0ea5e9');
assert.equal(patch.font, 'Cairo');
assert.equal(patch.background, '#ffffff', 'lightest color becomes the background');
assert.equal(patch.text, '#111827', 'darkest color becomes the text');

const brand = { ...DEFAULT_BRAND, enabled: true, name: 'Acme', primary: '#0ea5e9', displayFont: 'Cairo', language: 'ar' };
const tokens = designTokens(brand);
assert.equal(tokens.color.primary.$value, '#0ea5e9');
assert.equal(tokens.fontFamily.display.$value, 'Cairo');
assert.equal(tokens.borderRadius.base.$value, '12px');
assert.equal(tokens.content.language.$value, 'ar');

const asset = { id: 'a1', kind: 'doc', name: 'guide.md', mime: 'text/markdown', size: 12, addedAt: 1, text: '# Guide', lang: 'en' };
const roundtrip = parseDesignSystemFile(serializeDesignSystem(brand, [asset]));
assert.equal(roundtrip.brand.name, 'Acme');
assert.equal(roundtrip.assets.length, 1);
assert.throws(() => parseDesignSystemFile('{"format":"other"}'), /not a Sketch2UI design system/);
assert.throws(() => parseDesignSystemFile('not json'), /not a Sketch2UI design system/);

const board = brandBoardHtml(brand, [{ id: 'l1', kind: 'logo', name: 'logo.png', mime: 'image/png', size: 10, addedAt: 1, dataUrl: 'data:image/png;base64,AAAA' }]);
assert.match(board, /brand board/);
assert.match(board, /#0ea5e9/);
assert.match(board, /window\.print/);
assert.match(board, /data:image\/png;base64,AAAA/);
console.log('PASS: brand import — site extraction, token export, system file roundtrip, board html.');
