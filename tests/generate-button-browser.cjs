const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// The sketch panel carries its own Generate action: after drawing (or with
// just a written instruction), one press sends the sketch + instruction to
// the AI without hunting for the composer — on desktop and on a phone,
// where the composer lives behind the Instructions tab.
const SETTINGS = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  // Desktop: the button sits in the sketch panel and starts generation.
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  let calls = 0;
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), SETTINGS);
  await page.route('https://provider.example.test/**', r => { calls++; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>From sketch button</h1>}' } }] }) }); });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio');
  await page.getByLabel('Describe your interface').fill('build from the sketch panel');
  const btn = page.locator('.sketch-generate-button');
  await btn.waitFor({ timeout: 15000 });
  assert.equal((await btn.textContent()).includes('Generate from sketch'), true, 'the sketch action is labeled before the first generation');
  await btn.click();
  await page.locator('.preview-document').waitFor({ timeout: 20000 });
  assert.equal(calls, 1, 'one press sent exactly one generation request');
  assert.equal((await btn.textContent()).includes('Update interface'), true, 'after generation the same button offers an update');

  // Phone: write the instruction on its tab, return to the sketch tab, and
  // generate from there — the flow from the user's screenshot.
  const mob = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await mob.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), SETTINGS);
  await mob.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Mobile flow</h1>}' } }] }) }));
  await mob.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio');
  await mob.locator('.mobile-studio-nav button').nth(2).click();
  await mob.locator('footer.workspace-composer input').fill('mobile instruction');
  await mob.locator('.mobile-studio-nav button').nth(0).click();
  const mobBtn = mob.locator('.sketch-generate-button');
  await mobBtn.waitFor({ state: 'visible', timeout: 15000 });
  const box = await mobBtn.boundingBox();
  assert.ok(box && box.height >= 40, 'the phone generate button is a comfortable touch target');
  await mobBtn.click();
  await mob.locator('.mobile-studio-nav button').nth(1).click();
  await mob.locator('.preview-document').waitFor({ timeout: 20000 });
  console.log('PASS: sketch-panel Generate button starts generation on desktop and phone.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
