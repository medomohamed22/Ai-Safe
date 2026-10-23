const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// The AI Company demo template: one click on its home card loads the
// studio, the sketch DRAWS ITSELF element by element (~20s timelapse —
// generation must not start while it is still drawing), and only when
// the drawing completes does the AI generation fire, exactly once, with
// the full sketch persisted.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const CODE = 'export default function App(){return <main><h1>NovaMind</h1></main>}';
const URL = (process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/').replace(/#studio$/, '');
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((settings) => { localStorage.setItem('s2ui.settings.v1', JSON.stringify(settings)); }, BASE);
  let providerHits = 0;
  await page.route('https://provider.example.test/**', async (r) => { providerHits++; await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: CODE } }] }) }); });
  await page.goto(URL);
  const card = page.locator('.sketch-gallery .inspiration-card', { hasText: 'AI Company (Demo)' });
  await card.waitFor({ timeout: 30000 });
  const t0 = Date.now();
  await card.click();
  await page.waitForURL(/#studio/, { timeout: 30000 });
  await page.waitForTimeout(9000);
  assert.equal(providerHits, 0, 'generation has not started while the sketch is still drawing itself');
  await page.waitForFunction(() => {
    try {
      const project = JSON.parse(localStorage.getItem('s2ui.project.v1') || 'null');
      const screen = project?.screens?.find((s) => s.id === project.activeId);
      return (screen?.versions?.length || 0) >= 1;
    } catch { return false; }
  }, null, { timeout: 120000 });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 15000, `generation waited for the drawing (${elapsed}ms)`);
  assert.equal(providerHits, 1, 'exactly one generation fired after the drawing completed');
  const sceneCount = await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('s2ui.project.v1'));
    const screen = project.screens.find((s) => s.id === project.activeId);
    return screen.scene?.elements?.length || 0;
  });
  assert.ok(sceneCount >= 70, `the full sketch persisted (${sceneCount} elements)`);
  console.log(`PASS: drawn template — sketch drew itself for ${Math.round(elapsed / 1000)}s, then generated once with ${sceneCount} elements on canvas.`);
} finally { await browser.close(); } })().catch((error) => { console.error(error); process.exit(1); });
