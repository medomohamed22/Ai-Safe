const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// With "run checks after generation" ON, finishing a generation must NOT
// yank the user into the Productivity Studio: the preview stays in front,
// the checks run in the background, and their summary lands on the preview
// with a details button that opens the studio only on demand.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const CODE = 'export default function App(){return <main><h1>Tasks</h1><button>Add task</button></main>}';
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((settings) => {
    localStorage.setItem('s2ui.settings.v1', JSON.stringify(settings));
    localStorage.setItem('s2ui.quality.auto', 'true');
  }, BASE);
  await page.route('https://provider.example.test/**', async (r) => { await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: CODE } }] }) }); });
  await page.goto(URL);
  await page.getByLabel('Describe your interface').waitFor({ timeout: 30000 });
  await page.getByLabel('Describe your interface').fill('build a tasks page');
  await page.locator('.chat-column .send-button').click();
  await page.waitForFunction(() => {
    try {
      const project = JSON.parse(localStorage.getItem('s2ui.project.v1') || 'null');
      const screen = project?.screens?.find((s) => s.id === project.activeId);
      return (screen?.versions?.length || 0) >= 1;
    } catch { return false; }
  }, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.productivity-overlay').count(), 0, 'the studio did NOT open itself after generation');
  assert.ok(await page.locator('.output-panel iframe').first().isVisible().catch(() => false), 'the preview stays in front');
  await page.locator('.quality-notice').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('.quality-notice')?.textContent?.includes('Quality checks:'), null, { timeout: 90000 });
  await page.getByRole('button', { name: 'View details' }).click();
  await page.locator('.productivity-overlay').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.productivity-tab[aria-pressed="true"]').textContent().then((t) => t.trim()), 'Quality', 'View details opens the studio on the Quality tab');
  console.log('PASS: quality notice — generation keeps the preview in front, checks run in the background, details open on demand.');
} finally { await browser.close(); } })().catch((error) => { console.error(error); process.exit(1); });
