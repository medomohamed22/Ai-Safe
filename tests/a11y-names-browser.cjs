const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P2-04: in Arabic mode the preview tools speak Arabic, and no control in
// the app chrome (home + studio, excluding the third-party canvas and the
// generated app itself) is left without an accessible name.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => { localStorage.setItem('s2ui.language.v1', 'ar'); localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })); });
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>واجهة</h1>}' } }] }) }));
  const scan = () => page.evaluate(() => {
    const nameOf = el => (el.getAttribute('aria-label') || '').trim() || (el.textContent || '').trim() || (el.getAttribute('title') || '').trim();
    const bad = [];
    document.querySelectorAll('button, input, select, textarea, summary').forEach(el => {
      if (el.closest('.excalidraw') || el.closest('iframe')) return;
      if (!(el.offsetWidth || el.offsetHeight)) return;
      if (el.tagName === 'INPUT' && el.type === 'hidden') return;
      if (!nameOf(el)) bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`);
    });
    return bad;
  });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/');
  await page.waitForTimeout(1200);
  assert.deepEqual(await scan(), [], 'home: every visible control has an accessible name');
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  const box = page.getByLabel('صِف واجهتك');
  await box.fill('واجهة وصول');
  await page.keyboard.press('Enter');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });
  assert.deepEqual(await scan(), [], 'studio: every visible control has an accessible name');
  const moreName = await page.getByRole('button', { name: 'أدوات معاينة إضافية' }).getAttribute('aria-label');
  assert.equal(moreName, 'أدوات معاينة إضافية', 'the More tools button is named in Arabic');
  const fitName = await page.locator('.preview-viewport-tools button').first().getAttribute('aria-label');
  assert.ok(fitName && /[\u0600-\u06FF]/.test(fitName), `the Fit toggle is named in Arabic, got: ${fitName}`);
  console.log('PASS: Arabic preview tools carry Arabic names; no unnamed controls in home or studio chrome.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
