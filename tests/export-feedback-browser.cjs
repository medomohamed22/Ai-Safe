const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P2-05: exports announce themselves. Each download both fires a real
// browser download with the expected filename AND shows a status naming
// the saved file (before, both were silent).
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Export fixture</h1>}' } }] }) }));
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  const box = page.getByLabel('Describe your interface');
  await box.fill('export fixture');
  await page.keyboard.press('Enter');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });

  await page.locator('.export-menu summary').click();
  const jsxDownload = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('.export-dropdown button', { hasText: 'Download JSX' }).click();
  assert.equal((await jsxDownload).suggestedFilename(), 'App.jsx');
  await page.getByRole('status').filter({ hasText: 'Saved App.jsx' }).waitFor({ timeout: 8000 });

  await page.locator('.export-menu summary').click();
  const zipDownload = page.waitForEvent('download', { timeout: 20000 });
  await page.locator('.export-dropdown button', { hasText: 'Project ZIP' }).click();
  assert.equal((await zipDownload).suggestedFilename(), 'sketch2ui-project.zip');
  await page.getByRole('status').filter({ hasText: 'Saved sketch2ui-project.zip' }).waitFor({ timeout: 8000 });
  console.log('PASS: JSX and ZIP exports download with the right names and announce themselves.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
