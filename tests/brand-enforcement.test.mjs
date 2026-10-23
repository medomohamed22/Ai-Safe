import assert from 'node:assert/strict';
const { brandConformance } = await import('../src/lib/quality.ts');
const { buildFontFaceCss } = await import('../src/lib/brandAssets.ts');
const { buildPreviewHtml } = await import('../src/lib/preview.ts');

const palette = ['#cc2018', '#1830a0', '#ffffff', '#171717', '#f5f5f5', '#737373', '#16a34a', '#d97706', '#dc2626'];
const conf = brandConformance('<div style={{ background: "#cc2018", color: "#808080", borderColor: "#ff00ff" }} />', palette);
assert.deepEqual(conf.used, ['#cc2018'], 'in-palette colors are credited');
assert.deepEqual(conf.offPalette, ['#ff00ff'], 'a chromatic stranger is flagged; the neutral gray is shading, not identity');
assert.deepEqual(brandConformance('<div className="bg-white" />', palette).offPalette, [], 'no hexes, no flags');

const fontAsset = { id: 'f', kind: 'font', name: 'Cairo-Bold.woff2', mime: 'font/woff2', size: 1, addedAt: 1, dataUrl: 'data:font/woff2;base64,AAAA', fontFamily: 'Cairo Bold' };
const css = buildFontFaceCss([fontAsset], ['Cairo Bold']);
assert.ok(css.includes('@font-face') && css.includes("font-family: 'Cairo Bold'") && css.includes('format(\'woff2\')'), 'the uploaded font becomes a real @font-face');
assert.equal(buildFontFaceCss([fontAsset], ['Other']), '', 'unrelated families embed nothing');
const html = buildPreviewHtml('export default function App(){return <p>Hi</p>}', { token: 't', fontCss: css });
assert.ok(html.includes('@font-face'), 'the preview document carries the brand font');
console.log('PASS brand-enforcement: conformance credits palette colors and flags chromatic strangers (neutrals ignored), uploaded fonts become @font-face in the preview.');
