const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Item 18: the home route must boot WITHOUT the studio's heavy chunks
// (Excalidraw & friends load lazily when the studio opens). Runs against
// the production preview build (S2UI_PREVIEW_URL, default port 4173).
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  let homeJs = 0;
  const loaded = [];
  page.on('response', async res => {
    const url = res.url();
    if (!url.endsWith('.js')) return;
    try { const buf = await res.body(); loaded.push({ url, size: buf.length }); } catch { /* cached/aborted */ }
  });
  const previewUrl = process.env.S2UI_PREVIEW_URL || 'http://127.0.0.1:4173/';
  try { const probe = await fetch(previewUrl, { signal: AbortSignal.timeout(3000) }); if (!probe.ok) throw new Error('preview down'); } catch { console.log('SKIP: no production preview server at ' + previewUrl + ' (start one with: npm run build && npm run preview).'); return; }
  await page.goto(previewUrl);
  await page.locator('.design-home').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  homeJs = loaded.reduce((a, r) => a + r.size, 0);
  console.log('home route JS bytes:', homeJs, 'files:', loaded.map(r => r.url.split('/').pop()).join(', '));
  assert.ok(homeJs < 1_600_000, `home route should stay lean, got ${homeJs} bytes`);
  const before = loaded.length;
  await page.getByRole('button', { name: /Open studio/ }).first().click();
  await page.locator('.excalidraw').first().waitFor({ timeout: 30000 });
  assert.ok(loaded.length > before, 'studio chunks load on demand');
  console.log('PASS: home boots lean; the canvas chunk loads on studio open and Excalidraw mounts.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
