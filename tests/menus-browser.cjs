const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P2-01: on a narrow phone-width studio, in RTL and LTR, the Export dropdown
// and the More menu must render fully inside the viewport (the panels clip
// overflow, so a menu anchored the wrong way used to be cut at the edge),
// and the More menu closes with Escape.
async function checkMenus(page, lang) {
  await page.addInitScript(l => { localStorage.setItem('s2ui.language.v1', l); localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })); }, lang);
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Menu fixture</h1>}' } }] }) }));
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  // Phone layout: the composer lives behind the third mobile-nav tab.
  await page.locator('.mobile-studio-nav button').nth(2).click();
  const box = page.locator('footer.workspace-composer input');
  await box.fill('menu fixture');
  await page.keyboard.press('Enter');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });
  const within = async (selector) => page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, items: el.querySelectorAll('button').length }; });
  await page.locator('.export-menu summary').click();
  const dd = await within('.export-dropdown');
  assert.ok(dd.left >= -1 && dd.right <= 391, `${lang}: export dropdown inside viewport, got ${JSON.stringify(dd)}`);
  assert.ok(dd.items >= 5, `${lang}: export items present`);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'More preview tools' }).click();
  const menu = await within('.preview-more-menu');
  assert.ok(menu.left >= -1 && menu.right <= 391, `${lang}: more menu inside viewport, got ${JSON.stringify(menu)}`);
  assert.equal(menu.items, 3, `${lang}: all three more-menu items render`);
  await page.keyboard.press('Escape');
  await page.locator('.preview-more-menu').waitFor({ state: 'detached', timeout: 5000 });
}
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const ar = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await checkMenus(ar, 'ar');
  const en = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await checkMenus(en, 'en');
  console.log('PASS: export and more menus stay inside a 390px viewport in RTL and LTR; Escape closes the More menu.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
