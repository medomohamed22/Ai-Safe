const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// F3 + the Element Agent: with the preview runtime CDNs stalled, the stage
// must show a loading state (never a blank white frame) with an escape
// hatch; and a selected element can be edited by the agent — one extra
// provider call that returns only the replacement element, spliced into a
// page whose other code stays byte-identical.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const PAGE_REPLY = { choices: [{ message: { content: 'export default function App(){return <div><h1>Agent test</h1><button className="old">Click me</button></div>}' } }] };
const AGENT_REPLY = { choices: [{ message: { content: '<button className="agent-green">Click me</button>' } }] };
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), BASE);
  await page.route(/cdn\.tailwindcss\.com|unpkg\.com|esm\.sh/, () => {}); // stall: the app never posts ready
  let calls = 0; let agentBody = '';
  await page.route('https://provider.example.test/**', async (r) => { calls += 1; if (calls > 1) agentBody = r.request().postData() || ''; await r.fulfill({ contentType: 'application/json', body: JSON.stringify(calls === 1 ? PAGE_REPLY : AGENT_REPLY) }); });
  await page.goto(URL);
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByLabel('Describe your interface').fill('build a page with a button');
  await page.locator('.chat-column .send-button').click();
  await page.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });

  // F3: the loading state is up while the preview cannot boot.
  const loading = page.locator('.preview-loading');
  await loading.waitFor({ timeout: 10000 });
  assert.ok((await loading.textContent()).includes('Building your app'), 'the stage explains the wait instead of sitting white');
  await page.getByRole('button', { name: 'Show the preview anyway' }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Show the preview anyway' }).click();
  await loading.waitFor({ state: 'detached', timeout: 5000 });

  // Select the button (id 2 in traversal order) via the preview's own
  // message contract — this VM cannot render the preview document itself.
  await page.getByRole('button', { name: 'Select element' }).click();
  await page.evaluate(() => {
    const iframe = document.querySelector('.preview-frame');
    const token = ((iframe.getAttribute('srcdoc') || '').match(/var token = "([^"]+)"/) || [])[1];
    const ev = new MessageEvent('message', { data: { source: 's2ui-preview', type: 'element-selected', token, id: 2 } });
    Object.defineProperty(ev, 'source', { value: iframe.contentWindow });
    window.dispatchEvent(ev);
  });
  const inspector = page.locator('.element-inspector');
  await inspector.waitFor({ timeout: 10000 });
  assert.ok((await inspector.textContent()).includes('Edit element only'), 'the inspector offers the agent edit');
  await page.getByLabel('Selected element instruction').fill('make the button green');
  await page.getByRole('button', { name: 'Edit element only' }).click();
  await page.locator('.chat-msg.ai.built').nth(1).waitFor({ timeout: 20000 });
  const summary = await page.locator('.chat-msg.ai.built').nth(1).locator('.chat-stages-summary').textContent();
  assert.ok(summary.includes('Only the selected element changed'), 'the built summary names the surgical edit');
  assert.ok(summary.includes('lines changed'), 'the built summary reports how much changed');
  assert.equal(calls, 2, 'the agent used exactly one provider call');
  assert.ok(agentBody.includes('## Element to edit'), 'the agent received the element read');
  assert.ok(agentBody.includes('make the button green'), 'the agent received the instruction');
  const versions = await page.evaluate(() => JSON.parse(localStorage.getItem('s2ui.versions.v1') || '[]'));
  const latest = versions[versions.length - 1];
  assert.ok(latest.includes('agent-green'), 'the replacement element landed');
  assert.ok(latest.includes('<h1>Agent test</h1>'), 'the rest of the page stayed untouched');
  console.log('PASS: preview loading state with escape hatch, and the element agent surgical edit end-to-end.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
