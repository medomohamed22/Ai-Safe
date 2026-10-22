const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P3-03: while a request runs, the user sees a real elapsed clock (no fake
// percentages), and the alternatives view shows which of the three
// sequential requests are still pending.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  await page.route('https://provider.example.test/**', async r => { await new Promise(res => setTimeout(res, 2600)); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Timed design</h1>}' } }] }) }); });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  const box = page.getByLabel('Describe your interface');
  await box.fill('timed fixture');
  await page.keyboard.press('Enter');
  const status = page.locator('.workspace-status');
  await status.getByText(/0:0\d/).waitFor({ timeout: 15000 });
  assert.match(await status.textContent(), /Bringing your idea to life/, 'the generating status carries the elapsed clock');
  await page.locator('.preview-document').waitFor({ timeout: 25000 });

  await page.getByRole('button', { name: /designs/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /Design alternatives/ });
  await dialog.waitFor({ timeout: 10000 });
  await dialog.getByText('Waiting for this design…').first().waitFor({ timeout: 10000 });
  assert.ok(await dialog.locator('article').count() >= 1, 'pending alternative slots are shown while requests run');
  await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] article iframe').length === 3, null, { timeout: 30000 });
  console.log('PASS: elapsed clock during generation; alternatives show per-variant pending state.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
