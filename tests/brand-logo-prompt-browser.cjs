const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// The brand-logo incident, end to end: with a saved logo (a data URL) and
// the brand on, a generation request must carry the logo ONLY as an image
// part — never inside the prompt text — and if the model still pastes a
// base64 blob into its code, the saved version must contain the placeholder
// instead.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const LOGO = `data:image/png;base64,${'QUJD'.repeat(1500)}`;
const BLOB = `data:image/png;base64,${'WFla'.repeat(600)}`;
const CODE = `export default function App(){return <main><img src="${BLOB}" alt="logo" /><h1>AppHub tasks</h1></main>}`;
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(([settings, brand]) => {
    localStorage.setItem('s2ui.settings.v1', JSON.stringify(settings));
    localStorage.setItem('s2ui.brand.v1', JSON.stringify(brand));
  }, [BASE, { enabled: true, name: 'AppHub', primary: '#123456', secondary: '#737373', background: '#ffffff', text: '#171717', font: 'system-ui', radius: 12, direction: 'ltr', logo: LOGO, surface: '#f5f5f5', muted: '#737373', success: '#16a34a', warning: '#d97706', danger: '#dc2626', displayFont: '', language: 'auto', voice: '' }]);
  let requestText = '';
  let requestImages = 0;
  await page.route('https://provider.example.test/**', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    const content = body.messages?.[1]?.content;
    requestText = (body.messages || []).map((m) => typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '').join('\n');
    if (Array.isArray(content)) requestImages = content.filter((c) => c.type === 'image_url').length;
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: CODE } }] }) });
  });
  await page.goto(URL);
  await page.getByLabel('Describe your interface').waitFor({ timeout: 30000 });
  await page.getByLabel('Describe your interface').fill('build a tasks page');
  await page.locator('.chat-column .send-button').click();
  await page.waitForFunction(() => {
    try {
      const project = JSON.parse(localStorage.getItem('s2ui.project.v1') || 'null');
      const screen = project?.screens?.find((s) => s.id === project.activeId);
      return (screen?.versions?.length || 0) >= 1;
    } catch { return false; }
  }, null, { timeout: 60000 });
  assert.ok(requestText.includes('SAVED BRAND IDENTITY'), 'the brand identity is in the prompt');
  assert.ok(!requestText.includes('data:image'), 'the prompt TEXT carries no data URL');
  assert.ok(!requestText.includes('QUJD'), 'the prompt TEXT carries none of the logo base64');
  assert.ok(requestImages >= 1, 'the logo still travels as an attached image part');
  const saved = await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('s2ui.project.v1'));
    const screen = project.screens.find((s) => s.id === project.activeId);
    return screen.versions[screen.vIndex];
  });
  assert.ok(!saved.includes('WFla'), 'the saved code has none of the model-pasted base64');
  assert.ok(saved.includes('data:image/svg+xml'), 'the pasted image became the small SVG placeholder');
  console.log('PASS: brand logo — prompt text stays clean, logo rides as an image, pasted base64 is sanitized before saving.');
} finally { await browser.close(); } })().catch((error) => { console.error(error); process.exit(1); });
