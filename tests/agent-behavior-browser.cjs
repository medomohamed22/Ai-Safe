const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Agent v3 behavior edits, end to end: mohamed's exact case — select a
// button on a page with NO hooks at all, ask for "make it open a menu when
// clicked", and the agent must program it correctly: state injected into
// the component, the React hook import added by the system, the button
// wrapped with its conditional menu — and nothing else on the page moved.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const PAGE_CODE = 'export default function App(){return <div><h1>Shop</h1><button>Open menu</button></div>}';
const AGENT_REPLY = JSON.stringify({
  replace: '<div className="relative"><button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>Open menu</button>{menuOpen && (<div className="menu"><a href="#">Profile</a></div>)}</div>',
  addState: 'const [menuOpen, setMenuOpen] = useState(false);',
});
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), BASE);
  let calls = 0; let agentBody = '';
  await page.route('https://provider.example.test/**', async (r) => {
    calls += 1;
    if (calls > 1) agentBody = r.request().postData() || '';
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: calls === 1 ? PAGE_CODE : AGENT_REPLY } }] }) });
  });
  await page.goto(URL);
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByLabel('Describe your interface').fill('build a shop page');
  await page.locator('.chat-column .send-button').click();
  await page.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });

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
  await page.getByLabel('Selected element instruction').fill('make it open a menu when clicked');
  await page.getByRole('button', { name: 'Edit element only' }).click();
  await page.locator('.chat-msg.ai.built').nth(1).waitFor({ timeout: 20000 });
  const summary = await page.locator('.chat-msg.ai.built').nth(1).locator('.chat-stages-summary').textContent();
  assert.ok(summary.includes('state added to its component'), 'the summary is honest that state was added');
  assert.equal(calls, 2, 'one agent call, no repair needed');
  assert.ok(agentBody.includes('make it open a menu when clicked'), 'the agent received the instruction');
  const versions = await page.evaluate(() => JSON.parse(localStorage.getItem('s2ui.versions.v1') || '[]'));
  const latest = versions[versions.length - 1];
  assert.ok(latest.startsWith("import { useState } from 'react';"), 'the hook import was added mechanically');
  assert.ok(latest.includes('const [menuOpen, setMenuOpen] = useState(false);'), 'the state was injected into the component');
  assert.ok(latest.includes('menuOpen && (<div className="menu">'), 'the conditional menu renders from the button');
  assert.ok(latest.includes('aria-expanded={menuOpen}'), 'the trigger carries the expanded state');
  assert.ok(latest.includes('<h1>Shop</h1>'), 'the rest of the page stayed untouched');
  console.log('PASS: behavior edit end-to-end — a hookless button gains working menu behavior via verified state injection, with the page otherwise untouched.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
