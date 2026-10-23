const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Design-system phase 4, end to end: from the home page, one click on the
// Log in suggestion generates the page plus its three use-case states as
// linked screens — four provider calls, four screens, six links.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const CODE = 'export default function App(){return <div><h1>Sign in</h1><button>Continue</button></div>}';
const HOME = (process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio').replace(/#.*$/, '');
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), BASE);
  let calls = 0;
  const briefs = [];
  await page.route('https://provider.example.test/**', async (r) => {
    calls++;
    briefs.push(r.request().postData() || '');
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: CODE } }] }) });
  });
  await page.goto(HOME);
  const card = page.locator('.inspiration-card', { hasText: 'Log in page' });
  await card.waitFor({ timeout: 20000 });
  await card.click();
  const deadline = Date.now() + 180000;
  let project = null;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1500);
    project = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('s2ui.project.v1') || 'null'); } catch { return null; } }).catch(() => null);
    if (project && project.screens.length >= 4 && project.screens.every(s => (s.versions || []).length >= 1)) break;
  }
  assert.ok(project, 'the project state is readable');
  assert.equal(project.screens.length, 4, `the group has 4 screens (got ${project.screens.length}: ${project.screens.map(s => s.name).join(' | ')})`);
  assert.ok(project.screens.every(s => (s.versions || []).length >= 1), 'every screen was generated');
  assert.equal(project.links.length, 6, 'main <-> each state, both ways');
  assert.ok(project.screens.some(s => s.name === 'Log in page') && project.screens.some(s => s.name.includes('Error state')), 'screens are named for the page and its states');
  assert.equal(calls, 4, `exactly one generation per screen (got ${calls})`);
  assert.ok(briefs.some(b => b.includes('complete, polished Log in page')), 'the main brief reached the provider');
  assert.ok(briefs.some(b => b.includes('Forgot password')), 'a state brief reached the provider');
  console.log('PASS: page flow — one click on a suggestion card generates the page and its use-case states as linked screens in a single run.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
