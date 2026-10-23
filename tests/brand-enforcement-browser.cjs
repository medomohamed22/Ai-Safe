const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Design-system phase 3, end to end: with a saved brand + a logo asset in
// the library, a plain chat generation (no sketch) must carry the brand
// identity AND the brand reference image to the provider, and the review
// stage must honestly flag a color the model used outside the palette.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const BRAND = { enabled: true, name: 'Noor', primary: '#cc2018', secondary: '#1830a0', background: '#ffffff', text: '#171717', font: 'system-ui', radius: 12, direction: 'rtl', logo: '', language: 'ar' };
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const CODE = 'export default function App(){return <div style={{background:"#ff00ff"}}><h1>مهامي</h1></div>}';
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(([s, b]) => {
    localStorage.setItem('s2ui.settings.v1', JSON.stringify(s));
    localStorage.setItem('s2ui.brand.v1', JSON.stringify(b));
  }, [BASE, BRAND]);
  await page.addInitScript((logo) => {
    const req = indexedDB.open('sketch2ui-brand-assets', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('assets', { keyPath: 'id' });
    req.onsuccess = () => {
      const tx = req.result.transaction('assets', 'readwrite');
      tx.objectStore('assets').put({ id: 'a1', kind: 'logo', name: 'logo.png', mime: 'image/png', size: 10, addedAt: 1, dataUrl: logo });
    };
  }, LOGO);
  let body = '';
  await page.route('https://provider.example.test/**', async (r) => {
    body = r.request().postData() || '';
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: CODE } }] }) });
  });
  await page.goto(URL);
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByLabel('Describe your interface').fill('build a tasks page');
  await page.locator('.chat-column .send-button').click();
  await page.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });
  assert.ok(body.includes('SAVED BRAND IDENTITY'), 'the brand block reached the provider');
  assert.ok(body.includes('BRAND REFERENCE IMAGES'), 'the run was told brand images are attached');
  assert.ok(body.includes('data:image'), 'a brand image actually rode along');
  const summary = await page.locator('.chat-msg.ai.built .chat-stages-summary').textContent();
  assert.ok(summary.includes('colors outside the brand palette'), `the review stage flags the off-palette magenta (summary: ${summary})`);
  console.log('PASS: brand enforcement — identity + reference image reach generation, and the review stage flags off-palette colors.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
