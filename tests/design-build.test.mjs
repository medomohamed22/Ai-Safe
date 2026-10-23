import assert from 'node:assert/strict';
const { parseDesignBuild, designBuildInput, buildDesignSystem, majorityDocLanguage } = await import('../src/lib/designBuild.ts');
const { designSystemMarkdown, parseDesignSystem } = await import('../src/lib/designSystem.ts');
const { normalizeBrand } = await import('../src/lib/brand.ts');

const built = parseDesignBuild('{"name":"شركة النور","primary":"#CC2018","secondary":"#1830a0","background":"#fff","text":"#171717","surface":"#f5f5f5","muted":"not-a-color","success":"#16a34a","warning":"#d97706","danger":"#dc2626","font":"Cairo","displayFont":"Cairo","radius":120,"language":"ar","voice":"ودودة ومباشرة"}');
assert.equal(built.primary, '#cc2018', 'hex normalized');
assert.equal(built.background, '#ffffff', '3-digit hex expanded');
assert.equal(built.muted, undefined, 'an invalid color is dropped, never guessed');
assert.equal(built.radius, 80, 'radius clamped');
assert.equal(built.language, 'ar');
assert.throws(() => parseDesignBuild('no json here'), /did not return a usable result/);
assert.throws(() => parseDesignBuild('{broken'), /did not return a usable result/);

const assets = [
  { id: '1', kind: 'image', name: 'mood.png', mime: 'image/png', size: 1, addedAt: 1, dataUrl: 'data:image/png;base64,AAA', palette: ['#cc2018'] },
  { id: '2', kind: 'logo', name: 'logo.png', mime: 'image/png', size: 1, addedAt: 2, dataUrl: 'data:image/png;base64,BBB', palette: ['#1830a0'] },
  { id: '3', kind: 'doc', name: 'guide.md', mime: 'text/markdown', size: 1, addedAt: 3, text: 'دليل الهوية البصرية للشركة', lang: 'ar' },
  { id: '4', kind: 'font', name: 'Cairo.woff2', mime: 'font/woff2', size: 1, addedAt: 4, dataUrl: 'data:font/woff2;base64,CCC', fontFamily: 'Cairo' },
];
const input = designBuildInput(assets);
assert.equal(input.images[0], 'data:image/png;base64,BBB', 'logos go to the model first');
assert.ok(input.userText.includes('#cc2018') && input.userText.includes('دليل الهوية') && input.userText.includes('Cairo'), 'palettes, docs and fonts all reach the prompt');
assert.throws(() => designBuildInput([]), /Add at least one image, logo or document first/);
assert.equal(majorityDocLanguage(assets), 'ar');

let seen;
const full = await buildDesignSystem(assets, async (userText, system, images) => { seen = { userText, system, images }; return '{"name":"Noor","primary":"#cc2018","background":"#ffffff","text":"#171717"}'; });
assert.ok(seen.system.includes('senior brand designer') && seen.images.length === 2, 'the ask plumbing receives system + images');
assert.equal(full.language, 'ar', 'a missing model language falls back to the documents');
assert.equal(full.direction, 'rtl', 'Arabic systems are RTL');

// DESIGN.md v2 roundtrip + v1 tolerance.
const brand = normalizeBrand({ name: 'Noor', primary: '#cc2018', surface: '#fafafa', language: 'ar', voice: 'ودودة', displayFont: 'Cairo', enabled: true });
const md = designSystemMarkdown(brand);
assert.ok(md.includes('- Surface: #fafafa') && md.includes('- Content language: ar') && md.includes('- Voice: ودودة') && md.includes('- Display font: Cairo'), 'v2 lines are written');
const back = parseDesignSystem(md);
assert.equal(back.surface, '#fafafa'); assert.equal(back.language, 'ar'); assert.equal(back.voice, 'ودودة'); assert.equal(back.displayFont, 'Cairo');
const v1 = '# DESIGN.md — Old\n\n- Primary: #111111\n- Font: Georgia\n- Layout: ltr\n';
const oldParsed = parseDesignSystem(v1);
assert.equal(oldParsed.primary, '#111111'); assert.equal(oldParsed.language, undefined, 'v1 files still parse, new fields simply absent');
console.log('PASS design-build: builder JSON parsed defensively, inputs assembled logos-first with palettes/docs/fonts, language fallback + RTL, DESIGN.md v2 roundtrips and v1 still parses.');
