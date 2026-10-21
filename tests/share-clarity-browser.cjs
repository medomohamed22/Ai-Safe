const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P3-05: publish links state their length, warn when a chat/email app could
// truncate them, and a too-large app gets a publish-specific explanation
// with a ZIP/GitHub fallback instead of a confusing "review link" error.
const SETTINGS = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
function noise(chars) { let x = 0x9e3779b9, out = ''; const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; for (let i = 0; i < chars; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out += alpha[(x >>> 8) % 64]; } return out; }
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  // Small app: length shown, no truncation warning.
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), SETTINGS);
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Small app</h1>}' } }] }) }));
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  await page.getByLabel('Describe your interface').fill('small app');
  await page.keyboard.press('Enter');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'More preview tools' }).click();
  await page.getByRole('button', { name: 'Publish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish app' });
  await dialog.getByRole('button', { name: 'Create publish link' }).click();
  const lengthLine = dialog.locator('.link-length');
  await lengthLine.waitFor({ timeout: 10000 });
  assert.match(await lengthLine.textContent(), /Link length: \d+ characters/);
  assert.equal(await dialog.getByText(/Very long links can be truncated/).count(), 0, 'a short link carries no truncation warning');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Oversized app: the publish-specific limit message appears.
  const big = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await big.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), SETTINGS);
  const code = `export default function App(){ const s = "${noise(90000)}"; return <h1>{s.length}</h1> }`;
  await big.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: code } }] }) }));
  await big.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  await big.getByLabel('Describe your interface').fill('big app');
  await big.keyboard.press('Enter');
  await big.locator('.preview-document').waitFor({ timeout: 30000 });
  await big.getByRole('button', { name: 'More preview tools' }).click();
  await big.getByRole('button', { name: 'Publish' }).click();
  const bigDialog = big.getByRole('dialog', { name: 'Publish app' });
  await bigDialog.getByRole('button', { name: 'Create publish link' }).click();
  await bigDialog.getByText('This app is too large for a publish link (60 KB encoded limit). Export the project ZIP or push it to GitHub instead.').waitFor({ timeout: 15000 });
  console.log('PASS: publish links show their length; oversized apps get a publish-specific limit message.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
