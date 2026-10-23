import assert from 'node:assert/strict';
const { validateAssetFile, detectTextLanguage, fontFamilyFromName } = await import('../src/lib/brandAssets.ts');

assert.equal(validateAssetFile('image', { name: 'a.png', size: 1000, type: 'image/png' }), '');
assert.match(validateAssetFile('image', { name: 'a.gif', size: 1000, type: 'image/gif' }), /Unsupported/);
assert.match(validateAssetFile('image', { name: 'a.png', size: 3 * 1024 * 1024, type: 'image/png' }), /2 MB/);
assert.equal(validateAssetFile('logo', { name: 'logo.svg', size: 1000, type: '' }), '', 'SVG logos pass by extension');
assert.equal(validateAssetFile('doc', { name: 'دليل.md', size: 1000, type: '' }), '');
assert.match(validateAssetFile('doc', { name: 'big.md', size: 300 * 1024, type: 'text/markdown' }), /256 KB/);
assert.equal(validateAssetFile('font', { name: 'Cairo-Bold.woff2', size: 1000, type: '' }), '');
assert.match(validateAssetFile('font', { name: 'evil.exe', size: 1000, type: '' }), /Unsupported/);

assert.equal(detectTextLanguage('هذا دليل الهوية البصرية للشركة وألوانها الأساسية'), 'ar');
assert.equal(detectTextLanguage('This is the brand guideline document for our company'), 'en');
assert.equal(detectTextLanguage('Brand هوية مختلطة text نص'), 'mixed');
assert.equal(fontFamilyFromName('Cairo-Bold.woff2'), 'Cairo Bold');
assert.equal(fontFamilyFromName('IBM_Plex_Sans_Arabic.ttf'), 'IBM Plex Sans Arabic');
console.log('PASS brand-assets: per-kind validation with honest size limits, Arabic/English/mixed language detection, font family names from file names.');
