const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Publish with a short link: the generated app snapshot makes the raw
// link thousands of characters (no QR possible). Publishing now registers
// a short is.gd link (via the site proxy), shows THAT as the link, puts
// the QR on it, and offers a prominent Open button and a Download QR
// button. The proxy is stubbed here; the is.gd contract itself (fragment
// preserved through the 301) was verified live.
const CODE = 'export default function App(){return <main><h1>Shop</h1></main>}';
const SHORT = 'https://is.gd/xYz123';
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((code) => {
    const screen = { id: 's1', name: 'Home', versions: [code], vIndex: 0, scene: null, chat: [] };
    localStorage.setItem('s2ui.project.v1', JSON.stringify({ id: 'p1', name: 'Test', screens: [screen], activeId: 's1', links: [] }));
  }, CODE);
  await page.route('**/api/proxy**', async (r) => { await r.fulfill({ status: 200, contentType: 'text/plain', body: SHORT }); });
  await page.goto(URL);
  await page.getByLabel('More preview tools').waitFor({ timeout: 30000 });
  await page.getByLabel('More preview tools').click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish app' });
  await dialog.waitFor({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Create publish link' }).click();
  const field = dialog.getByLabel('Publish link');
  await page.waitForFunction((short) => document.querySelector('textarea[aria-label="Publish link"]')?.value === short, SHORT, { timeout: 30000 });
  assert.equal(await field.inputValue(), SHORT, 'the SHORT link is what the user gets');
  assert.equal(await dialog.getByRole('link', { name: 'Open published app' }).getAttribute('href'), SHORT, 'the prominent Open button targets the short link');
  assert.ok(await dialog.locator('svg[aria-label="QR code for the published app"]').isVisible(), 'the QR renders for the short link');
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await dialog.getByRole('button', { name: 'Download QR' }).click();
  const download = await downloadPromise;
  assert.ok((download.suggestedFilename() || '').endsWith('.png'), 'Download QR saves a PNG');
  console.log('PASS: publish — short link everywhere, prominent Open, QR shown and downloadable.');
} finally { await browser.close(); } })().catch((error) => { console.error(error); process.exit(1); });
