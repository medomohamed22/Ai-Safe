const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Item 17 + F5: a provider failure must surface a friendly, actionable
// message (never the raw HTTP body). A transient 429 is first retried once
// automatically (F5); only when the retry also fails does the banner
// appear, and its manual Retry re-runs the same generation.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  let calls = 0;
  let mode = 'once'; // 'once': first call 429s, later calls succeed · 'always': every call 429s · 'ok': succeed
  await page.route('https://provider.example.test/**', r => {
    calls++;
    if (mode === 'always' || (mode === 'once' && calls === 1)) return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'RAW_UPSTREAM_DETAIL should never reach the user' } }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Recovered</h1>}' } }] }) });
  });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');

  // F5: one transient 429 heals itself — the build completes with no banner
  // and no user action.
  await page.getByLabel('Describe your interface').fill('A simple counter page');
  await page.keyboard.press('Enter');
  await page.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });
  assert.equal(calls, 2, 'the transient failure was retried exactly once');
  assert.ok(!(await page.locator('body').innerText()).includes('RAW_UPSTREAM_DETAIL'), 'raw upstream body must not be shown');
  assert.equal(await page.locator('.preview-error').count(), 0, 'no error banner after a healed failure');

  // When the failure persists past the automatic retry, the friendly banner
  // appears and its manual Retry re-runs the generation.
  mode = 'always';
  await page.getByLabel('Describe your interface').fill('Another page please');
  await page.keyboard.press('Enter');
  const banner = page.getByRole('alert').filter({ hasText: 'Rate limit reached' });
  await banner.waitFor({ timeout: 20000 });
  const text = await banner.innerText();
  assert.ok(!text.includes('RAW_UPSTREAM_DETAIL'), 'raw upstream body must not be shown');
  assert.ok(!text.includes('HTTP 429'), 'raw HTTP status line must not be shown');
  const before = calls;
  mode = 'ok';
  await banner.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.preview-error'), null, { timeout: 20000 });
  assert.ok(calls > before, 'retry re-ran the generation request');
  console.log('PASS: transient 429 auto-retried (F5); persistent failure shows the friendly message without raw body, and manual Retry re-runs and clears it.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
