const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Item 20: a first-time visitor sees the 60-second quickstart strip above
// the sample sketches; dismissing it hides it for good (same browser).
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto((process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/').replace('#studio', ''));
  const strip = page.locator('.quickstart');
  await strip.waitFor({ timeout: 15000 });
  assert.equal(await strip.locator('.qs-step').count(), 3, 'three quickstart steps');
  assert.match(await strip.innerText(), /Pick a sample sketch/);
  await strip.getByRole('button', { name: 'Close', exact: true }).click();
  await strip.waitFor({ state: 'detached', timeout: 5000 });
  await page.reload();
  await page.locator('.sketch-gallery').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.quickstart').count(), 0, 'dismissed strip stays hidden after reload');
  console.log('PASS: quickstart strip shows once, dismisses, and stays dismissed.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
