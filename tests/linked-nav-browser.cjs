const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Linked screens, end to end in the studio: a seeded two-screen group shows
// a tab bar with the active screen marked, the preview document carries the
// navigation bridge, a navigate message from inside the preview switches
// the active screen — and picking a brand color switches the brand ON and
// persists it (logo/colors apply to new generations without a hidden step).
const CODE1 = 'export default function App(){return <main><h1>Sign in</h1><a href="#">Forgot password?</a></main>}';
const CODE2 = 'export default function App(){return <main><h1>Reset password</h1></main>}';
const PROJECT = {
  activeId: 's1',
  links: [{ from: 's1', to: 's2', label: 'Forgot password' }, { from: 's2', to: 's1', label: 'Log in page' }],
  screens: [
    { id: 's1', name: 'Log in page', versions: [CODE1], vIndex: 0, scene: null, chat: [] },
    { id: 's2', name: 'Log in page — Forgot password', versions: [CODE2], vIndex: 0, scene: null, chat: [] },
  ],
};
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((project) => { localStorage.setItem('s2ui.project.v1', JSON.stringify(project)); }, PROJECT);
  await page.goto(URL);
  const tabs = page.locator('.screen-navigation .screen-tab');
  await tabs.first().waitFor({ timeout: 30000 });
  assert.equal(await tabs.count(), 2, 'both group screens appear as tabs');
  assert.match(await tabs.first().getAttribute('class'), /screen-tab-active/, 'the current screen tab is marked active');
  assert.equal(await tabs.first().getAttribute('aria-current'), 'page');
  assert.match(await tabs.nth(1).textContent(), /Forgot password/);

  const srcdoc = await page.locator('iframe[title="Live preview"]').getAttribute('srcdoc');
  assert.ok(srcdoc && srcdoc.includes('s2uiNavigate'), 'the preview document carries the navigation bridge');

  const frame = page.frames().find((f) => f.url().startsWith('about:srcdoc'));
  assert.ok(frame, 'the preview frame exists');
  await frame.evaluate(() => parent.postMessage({ source: 's2ui-preview', type: 'navigate', id: 's2' }, '*'));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('s2ui.project.v1') || '{}').activeId === 's2', null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('.screen-navigation .screen-tab')[1]?.classList.contains('screen-tab-active'), null, { timeout: 15000 });

  // Brand: picking a color is the apply action — the brand turns on and persists.
  await page.getByRole('button', { name: 'Brand', exact: true }).click();
  await page.waitForSelector('input[aria-label="Brand primary"]', { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector('input[aria-label="Brand primary"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '#ff0055');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => { const b = JSON.parse(localStorage.getItem('s2ui.brand.v1') || '{}'); return b.enabled === true && b.primary === '#ff0055'; }, null, { timeout: 15000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const b = JSON.parse(localStorage.getItem('s2ui.brand.v1') || '{}'); return b.enabled === true && b.primary === '#ff0055'; }, null, { timeout: 30000 });
  assert.ok(await page.locator('.sidebar-action .sidebar-dot').count() >= 1, 'the sidebar shows the brand is active');
  console.log('PASS: linked navigation — group tabs with an active marker, in-preview navigate switches screens, brand color pick auto-applies and persists.');
} finally { await browser.close(); } })().catch((error) => { console.error(error); process.exit(1); });
