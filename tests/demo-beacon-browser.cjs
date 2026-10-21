const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Item 13: the home screen shows a live demo-status beacon driven by
// /api/demo — "live" when the hosted demo is on, an honest off note when not.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const base = (process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/').replace('#studio', '');
  const on = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await on.route('**/api/demo', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ demo: true, provider: 'meta', model: 'muse-spark-1.3' }) }));
  await on.goto(base);
  await on.locator('.demo-beacon.is-on', { hasText: 'Instant demo is live' }).waitFor({ timeout: 15000 });
  await on.close();
  const off = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await off.route('**/api/demo', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ demo: false }) }));
  await off.goto(base);
  await off.locator('.demo-beacon.is-off', { hasText: 'Instant demo is off' }).waitFor({ timeout: 15000 });
  await off.close();
  console.log('PASS: demo beacon shows live and off states from /api/demo.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
