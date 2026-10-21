const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Item 17: a provider failure must surface a friendly, actionable message
// (never the raw HTTP body), and the banner's Retry must re-run the same
// generation — here the provider 429s once, then succeeds on the retry.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  let calls = 0;
  await page.route('https://provider.example.test/**', r => {
    calls++;
    if (calls === 1) return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'RAW_UPSTREAM_DETAIL should never reach the user' } }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Recovered</h1>}' } }] }) });
  });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  await page.getByLabel('Describe your interface').fill('A simple counter page');
  await page.keyboard.press('Enter');
  const banner = page.getByRole('alert').filter({ hasText: 'Rate limit reached' });
  await banner.waitFor({ timeout: 20000 });
  const text = await banner.innerText();
  assert.ok(!text.includes('RAW_UPSTREAM_DETAIL'), 'raw upstream body must not be shown');
  assert.ok(!text.includes('HTTP 429'), 'raw HTTP status line must not be shown');
  await banner.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.preview-error'), null, { timeout: 20000 });
  assert.ok(calls >= 2, 'retry re-ran the generation request');
  console.log('PASS: friendly 429 message without raw body, Retry re-runs generation and clears the error.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
