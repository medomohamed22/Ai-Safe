const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Design-system phase 2, end to end: upload a logo-ish image + an Arabic
// guideline doc, press Build — the model (mocked) returns a full token set
// and the panel fills in an Arabic RTL system with a visible brand board.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const RED_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const AR_DOC = '# دليل الهوية\nهذه هي الهوية البصرية لشركتنا وألوانها الأساسية ونبرة كلامنا مع العملاء دائمًا ودودة وواضحة.';
const BUILD_JSON = JSON.stringify({ name: 'شركة النور', primary: '#cc2018', secondary: '#1830a0', background: '#ffffff', text: '#171717', surface: '#f5f5f5', muted: '#737373', success: '#16a34a', warning: '#d97706', danger: '#dc2626', font: 'Cairo', displayFont: 'Cairo', radius: 10, language: 'ar', voice: 'ودودة ومباشرة', rules: ['استخدم الأحمر للأزرار الأساسية'] });
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), BASE);
  let buildBody = '';
  await page.route('https://provider.example.test/**', async (r) => {
    buildBody = r.request().postData() || '';
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: BUILD_JSON } }] }) });
  });
  await page.goto(URL);
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'Edit design identity' }).click();
  const dialog = page.getByRole('dialog', { name: 'Brand identity' });
  await dialog.waitFor({ timeout: 10000 });
  await dialog.locator('input[aria-label="Add a logo file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: RED_PNG });
  await dialog.locator('li', { hasText: 'logo.png' }).waitFor({ timeout: 10000 });
  await dialog.locator('input[aria-label="Add a document"]').setInputFiles({ name: 'guide.md', mimeType: 'text/markdown', buffer: Buffer.from(AR_DOC) });
  await dialog.locator('li', { hasText: 'guide.md' }).waitFor({ timeout: 10000 });
  await dialog.getByRole('button', { name: 'Build my design system' }).click();
  await dialog.getByText('Design system built from your assets.').waitFor({ timeout: 15000 });
  assert.ok(buildBody.includes('senior brand designer'), 'the builder prompt reached the provider');
  assert.equal(await dialog.locator('input[aria-label="Brand name"]').inputValue(), 'شركة النور', 'the brand name came from the build');
  assert.equal(await dialog.locator('select[aria-label="Brand content language"]').inputValue(), 'ar', 'the system language is Arabic');
  assert.equal(await dialog.locator('input[aria-label="Brand primary"]').inputValue(), '#cc2018', 'the primary came from the build');
  assert.ok((await dialog.textContent()).includes('#cc2018'), 'the brand board shows the palette');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('s2ui.brand.v1') || '{}'));
  assert.equal(saved.language, 'ar'); assert.equal(saved.direction, 'rtl'); assert.equal(saved.enabled, true);
  console.log('PASS: design-system build — assets in, one AI pass, an Arabic RTL token set fills the panel and persists with a visible brand board.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
