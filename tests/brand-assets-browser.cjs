const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Design-system phase 1: the brand panel takes a real asset library —
// images with an instantly extracted palette (no AI), documents with a
// detected language, fonts by family name — persisted in IndexedDB.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
// A 1x1 solid red PNG (well-known minimal valid file).
const RED_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const AR_DOC = '# دليل الهوية\nهذه هي الهوية البصرية لشركتنا وألوانها الأساسية ونبرة كلامنا مع العملاء دائمًا ودودة وواضحة.';
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), BASE);
  await page.goto(URL);
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'Edit design identity' }).click();
  const dialog = page.getByRole('dialog', { name: 'Brand identity' });
  await dialog.waitFor({ timeout: 10000 });
  await dialog.locator('input[aria-label="Add images"]').setInputFiles({ name: 'mood.png', mimeType: 'image/png', buffer: RED_PNG });
  await dialog.locator('li', { hasText: 'mood.png' }).waitFor({ timeout: 10000 });
  await dialog.getByText('Extracted palette').waitFor({ timeout: 10000 });
  const apply = dialog.getByRole('button', { name: 'Use palette as brand colors' });
  await apply.click();
  const primary = await dialog.locator('input[aria-label="Brand primary"]').inputValue();
  assert.ok(/^#?[ef]/i.test(primary.replace('#', '#')) && primary.toLowerCase() !== '#171717', `the palette seeded the brand primary (got ${primary})`);
  await dialog.locator('input[aria-label="Add a document"]').setInputFiles({ name: 'guide.md', mimeType: 'text/markdown', buffer: Buffer.from(AR_DOC) });
  const docRow = dialog.locator('li', { hasText: 'guide.md' });
  await docRow.waitFor({ timeout: 10000 });
  assert.ok((await docRow.textContent()).includes('Arabic'), 'the Arabic document is badged Arabic');
  await dialog.locator('input[aria-label="Add a font"]').setInputFiles({ name: 'Cairo-Bold.woff2', mimeType: 'font/woff2', buffer: Buffer.from('wOF2-fake-bytes') });
  const fontRow = dialog.locator('li', { hasText: 'Cairo-Bold.woff2' });
  await fontRow.waitFor({ timeout: 10000 });
  assert.ok((await fontRow.textContent()).includes('Cairo Bold'), 'the font shows its family name');
  await page.reload();
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'Edit design identity' }).click();
  await dialog.locator('li', { hasText: 'mood.png' }).waitFor({ timeout: 10000 });
  await dialog.locator('li', { hasText: 'guide.md' }).waitFor({ timeout: 10000 });
  await dialog.locator('li', { hasText: 'Cairo-Bold.woff2' }).waitFor({ timeout: 10000 });
  console.log('PASS: brand assets — image upload extracts a palette that seeds brand colors, Arabic docs are badged, fonts list by family, everything persists across reload.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
