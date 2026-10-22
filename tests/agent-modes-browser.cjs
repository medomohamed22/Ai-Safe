const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Item 33 (agent round 2), 37 (save to library), 38 (checks) and 34
// (compare versions): the inspector saves an element into the component
// library and shows local accessibility checks; the agent can INSERT a new
// element inside a selected container and can apply ONE instruction to
// several shift-selected elements in a single verified run; and any two
// saved versions can be compared side by side with a line diff.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const PAGE_CODE = 'export default function App(){return <div><h1>Modes</h1><p>Body text</p></div>}';
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), BASE);
  const userTexts = [];
  await page.route('https://provider.example.test/**', async (r) => {
    let userText = '';
    try { const j = JSON.parse(r.request().postData() || '{}'); userText = (j.messages || []).map(m => (typeof m.content === 'string' ? m.content : '')).join('\n'); } catch { /* keep empty */ }
    userTexts.push(userText);
    let content = PAGE_CODE;
    if (userText.includes('## Container element')) content = '<span className="badge">New badge</span>';
    else {
      const snippet = (userText.match(/## Element to edit[\s\S]*?```jsx\n([\s\S]*?)```/) || [])[1] || '';
      if (snippet.includes('<h1>')) content = '<h1 className="big">Modes</h1>';
      else if (snippet.includes('<p>')) content = '<p className="lead">Body text</p>';
    }
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  await page.goto(URL);
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByLabel('Describe your interface').fill('build a page');
  await page.locator('.chat-column .send-button').click();
  await page.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });

  const select = (data) => page.evaluate((d) => {
    const iframe = document.querySelector('.preview-frame');
    const token = ((iframe.getAttribute('srcdoc') || '').match(/var token = "([^"]+)"/) || [])[1];
    const ev = new MessageEvent('message', { data: { source: 's2ui-preview', type: 'element-selected', token, ...d } });
    Object.defineProperty(ev, 'source', { value: iframe.contentWindow });
    window.dispatchEvent(ev);
  }, data);
  const latestCode = () => page.evaluate(() => { const v = JSON.parse(localStorage.getItem('s2ui.versions.v1') || '[]'); return v[v.length - 1] || ''; });

  await page.getByRole('button', { name: 'Select element' }).click();

  // 37 + 38: select the root div — save it to the library, checks render.
  await select({ id: 0 });
  const inspector = page.locator('.element-inspector');
  await inspector.waitFor({ timeout: 10000 });
  assert.ok((await inspector.textContent()).includes('Checks'), 'the inspector shows the local checks section');
  assert.ok((await inspector.textContent()).includes('Text contrast'), 'contrast check is listed');
  await page.getByRole('button', { name: 'Save to library' }).click();
  await page.waitForFunction(() => (localStorage.getItem('s2ui.components.v1') || '').includes('SavedDiv'), null, { timeout: 5000 });
  const library = await page.evaluate(() => JSON.parse(localStorage.getItem('s2ui.components.v1') || '[]'));
  assert.equal(library.length, 1);
  assert.ok(library[0].code.startsWith('export default function SavedDiv()'), 'the element was wrapped as a reusable component');
  assert.ok(library[0].code.includes('<h1>Modes</h1>'), 'the saved component carries the element source');

  // 33 insert: add a badge inside the div.
  await page.getByRole('button', { name: 'Add inside it' }).click();
  await page.getByLabel('Selected element instruction').fill('add a badge');
  await page.getByRole('button', { name: 'Add inside this element' }).click();
  await page.locator('.chat-msg.ai.built').nth(1).waitFor({ timeout: 20000 });
  const insertSummary = await page.locator('.chat-msg.ai.built').nth(1).locator('.chat-stages-summary').textContent();
  assert.ok(insertSummary.includes('Added one new element inside'), 'the summary names the insertion');
  assert.ok(userTexts.some(t => t.includes('## Container element') && t.includes('add a badge')), 'the agent received the container read and the instruction');
  const afterInsert = await latestCode();
  assert.ok(afterInsert.includes('<span className="badge">New badge</span>'), 'the new element landed');
  assert.ok(afterInsert.includes('<p>Body text</p>'), 'existing children stayed untouched');

  // 33 multi: one instruction applied to the h1 and the p in a single run.
  await select({ id: 1, multi: true, ids: [1, 2] });
  await inspector.waitFor({ timeout: 10000 });
  assert.ok((await inspector.textContent()).includes('2 elements selected'), 'the inspector reflects the multi-selection');
  const callsBefore = userTexts.length;
  await page.getByLabel('Selected element instruction').fill('emphasize both');
  await page.getByRole('button', { name: 'Edit 2 elements only' }).click();
  await page.locator('.chat-msg.ai.built').nth(2).waitFor({ timeout: 20000 });
  const multiSummary = await page.locator('.chat-msg.ai.built').nth(2).locator('.chat-stages-summary').textContent();
  assert.ok(multiSummary.includes('Edited 2 of 2 elements'), 'the summary reports both edits');
  assert.equal(userTexts.length - callsBefore, 2, 'one provider call per selected element, one run');
  const afterMulti = await latestCode();
  assert.ok(afterMulti.includes('<h1 className="big">Modes</h1>'), 'the h1 was edited');
  assert.ok(afterMulti.includes('<p className="lead">Body text</p>'), 'the p was edited');
  assert.ok(afterMulti.includes('<span className="badge">New badge</span>'), 'everything else stayed untouched');

  // 34: compare the first and last versions.
  await page.locator('.preview-more-wrap > button').click();
  await page.getByRole('button', { name: 'Compare versions' }).click();
  const dialog = page.getByRole('dialog', { name: 'Compare versions' });
  await dialog.waitFor({ timeout: 10000 });
  assert.ok((await dialog.textContent()).includes('lines changed'), 'the compare dialog summarizes the change size');
  assert.equal(await dialog.locator('iframe').count(), 2, 'both versions render side by side');
  await dialog.getByLabel('Earlier version').selectOption('0');
  const versionCount = await page.evaluate(() => JSON.parse(localStorage.getItem('s2ui.versions.v1') || '[]').length);
  await dialog.getByLabel('Later version').selectOption(String(versionCount - 1));
  assert.ok((await dialog.textContent()).includes('Code changes'), 'the code diff section is present');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 });
  console.log('PASS: save-to-library + checks in the inspector, agent insert mode, multi-element agent run, and the version compare dialog.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
