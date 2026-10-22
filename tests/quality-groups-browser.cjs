const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P3-04: quality results render grouped by action area with per-group
// pass counts, instead of one flat list. Runs against the editor-only dev
// server, so the bundle row is blocked (no build service) and the preview
// frame cannot load its CDNs in this environment — the runtime row lands
// in Runtime either as an error or after the frame timeout.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <main><h1>Group fixture</h1><button>Add</button></main>}' } }] }) }));
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  await page.getByLabel('Describe your interface').fill('group fixture');
  await page.keyboard.press('Enter');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Productivity studio' }).click();
  const dialog = page.getByRole('dialog', { name: 'Productivity studio' });
  await dialog.getByRole('button', { name: 'Run automatic checks' }).click();
  const buildGroup = dialog.locator('.quality-group', { hasText: 'Build' });
  await buildGroup.waitFor({ timeout: 120000 });
  assert.match(await buildGroup.locator('h4').textContent(), /Build — \d+\/3 Passed/, 'the build group counts the two source checks plus the bundle row');
  assert.match(await buildGroup.textContent(), /Production JavaScript bundle/, 'the bundle row sits in Build');
  const acceptance = dialog.locator('.quality-group', { hasText: 'Acceptance scenarios' });
  await acceptance.waitFor({ timeout: 10000 });
  assert.match(await acceptance.textContent(), /No acceptance scenarios were provided/, 'the untested explanation sits in the acceptance group');
  console.log('PASS: quality results are grouped (Build, Acceptance) with per-group counts.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
