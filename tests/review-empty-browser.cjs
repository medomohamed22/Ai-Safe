const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P2-02: opening Review with no candidate must say so — not paint the whole
// current file as deleted. A real candidate brings the comparison back, and
// rejecting it returns to the honest empty state with the code untouched.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  let calls = 0;
  await page.route('https://provider.example.test/**', r => { calls++; const title = calls === 1 ? 'Version one' : 'Version two'; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: `export default function App(){return <h1>${title}</h1>}` } }] }) }); });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  const box = page.getByLabel('Describe your interface');
  await box.fill('review fixture');
  await page.keyboard.press('Enter');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });

  await page.getByRole('button', { name: 'Productivity studio', exact: true }).click();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByText('No candidate to review yet.').waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.productivity-report').count(), 0, 'no diff report is rendered without a candidate');
  assert.equal(await page.locator('.comparison-previews').count(), 0, 'no comparison previews without a candidate');
  await page.getByLabel('Review new generations before applying').check();

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await box.fill('make it version two');
  await page.keyboard.press('Enter');
  // The pending change reopens the studio on the review with a real diff.
  await page.locator('.comparison-previews').waitFor({ timeout: 25000 });
  const stats = await page.locator('.productivity-page p').filter({ hasText: 'added lines' }).textContent();
  assert.match(stats, /added lines/, 'a real candidate shows real diff statistics');
  const versionsBefore = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('s2ui.project.v1')); const s = p.screens.find(x => x.id === p.activeId); return s.versions.length; });
  await page.getByRole('button', { name: 'Reject candidate', exact: true }).click();
  await page.getByText('No candidate to review yet.').waitFor({ timeout: 10000 });
  const versionsAfter = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('s2ui.project.v1')); const s = p.screens.find(x => x.id === p.activeId); return s.versions.length; });
  assert.equal(versionsAfter, versionsBefore, 'rejecting never touches the current code versions');
  console.log('PASS: empty review is honest, a real candidate diffs, reject restores the empty state.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
