const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P1-05: a failed generation keeps the user's words. After a provider 503
// that also fails the one automatic retry (F5), the instruction returns to
// the composer and to the screen's stored draft; a successful manual retry
// consumes the draft. The plan brief survives switching
// productivity sections (the panel unmounts between sections).
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  let calls = 0;
  await page.route('https://provider.example.test/**', r => {
    calls++;
    if (calls <= 2) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'overloaded' } }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Recovered draft</h1>}' } }] }) });
  });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  const box = page.getByLabel('Describe your interface');
  await box.fill('لوحة مهام أسبوعية');
  await page.keyboard.press('Enter');
  await page.getByRole('alert').filter({ hasText: 'having trouble' }).waitFor({ timeout: 20000 });
  assert.equal(await box.inputValue(), 'لوحة مهام أسبوعية', 'the failed instruction returns to the composer');
  const draftAfterFail = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('s2ui.project.v1')); return localStorage.getItem(`s2ui.draft.v1.${p.activeId}`); });
  assert.equal(JSON.parse(draftAfterFail), 'لوحة مهام أسبوعية', 'the failed instruction is stored as the screen draft');
  await page.getByRole('alert').getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.preview-error'), null, { timeout: 20000 });
  const draftAfterSuccess = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('s2ui.project.v1')); return localStorage.getItem(`s2ui.draft.v1.${p.activeId}`); });
  assert.equal(JSON.parse(draftAfterSuccess), '', 'a successful retry consumes the stored draft');

  // Plan brief persistence across productivity sections.
  await page.getByRole('button', { name: 'Productivity studio', exact: true }).click();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  const brief = page.getByLabel('Plan brief');
  await brief.fill('تطبيق مهام بفريق صغير');
  await page.waitForFunction(() => Object.keys(localStorage).some(k => k.startsWith('s2ui.plan-draft.') && (localStorage.getItem(k) || '').includes('تطبيق مهام')), null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Quality', exact: true }).click();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  assert.equal(await page.getByLabel('Plan brief').inputValue(), 'تطبيق مهام بفريق صغير', 'the plan brief survives section switches');
  console.log('PASS: failed instructions restore to the composer/draft, success consumes the draft, plan brief persists.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
