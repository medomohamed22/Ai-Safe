const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Claude Design-style split: the AI conversation lives in its own column
// (thread + composer) beside the work column (sketch + preview). On a phone
// the conversation becomes the Chat tab, fully usable on its own.
const SETTINGS = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const REPLY = { choices: [{ message: { content: 'export default function App(){return <h1>Chat layout works</h1>}' } }] };
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  // Desktop: chat column sits beside the work column, composer inside it.
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), SETTINGS);
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(REPLY) }));
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio');
  // Stage model: one big stage — the sketch fills it first, the preview hides.
  assert.equal(await page.locator('.workspace-grid').getAttribute('data-focus'), 'sketch', 'the stage starts on the sketch');
  assert.equal(await page.locator('.output-panel').isVisible(), false, 'the preview panel hides behind the stage toggle');
  const chatCol = page.locator('.chat-column');
  await chatCol.waitFor({ state: 'visible', timeout: 15000 });
  const chatBox = await chatCol.boundingBox();
  const gridBox = await page.locator('.workspace-grid').boundingBox();
  assert.ok(chatBox && gridBox && chatBox.x + chatBox.width <= gridBox.x + 1, 'the chat column sits beside (before) the work column');
  await page.getByLabel('Describe your interface').fill('build a chat test page');
  await page.locator('.chat-column .send-button').click();
  await page.locator('.chat-msg.user', { hasText: 'build a chat test page' }).waitFor({ timeout: 15000 });
  await page.locator('.chat-msg.ai.built', { hasText: 'Your new version is ready in the preview.' }).waitFor({ timeout: 20000 });
  assert.equal(await page.locator('.workspace-grid').getAttribute('data-focus'), 'preview', 'sending flips the stage from sketch to preview');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });

  // Arabic RTL: the chat column stays pinned to the LEFT, content stays RTL.
  const ar = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await ar.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), SETTINGS);
  await ar.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio');
  await ar.getByRole('button', { name: 'العربية', exact: true }).click();
  await ar.waitForFunction(() => document.documentElement.dir === 'rtl');
  const arChat = await ar.locator('.chat-column').boundingBox();
  const arGrid = await ar.locator('.workspace-grid').boundingBox();
  assert.ok(arChat && arGrid && arChat.x + arChat.width <= arGrid.x + 1, 'in RTL the chat column is still on the left');

  // Phone: the Chat tab shows the conversation (thread + composer); the
  // work column hides; a send from the Chat tab generates and the thread
  // keeps the whole exchange.
  const mob = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await mob.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), SETTINGS);
  await mob.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(REPLY) }));
  await mob.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio');
  const chatTab = mob.locator('.mobile-studio-nav button').nth(2);
  assert.equal((await chatTab.textContent()).includes('Chat'), true, 'the third phone tab is the Chat tab');
  await chatTab.click();
  const mobCol = mob.locator('.chat-column');
  await mobCol.waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await mob.locator('.work-column').isVisible(), false, 'the work column hides behind the Chat tab');
  await mob.locator('.chat-column footer.workspace-composer input').fill('mobile chat instruction');
  await mob.locator('.chat-column .send-button').click();
  await mob.locator('.chat-msg.user', { hasText: 'mobile chat instruction' }).waitFor({ timeout: 15000 });
  await mob.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });
  await mob.locator('.mobile-studio-nav button').nth(1).click();
  await mob.locator('.preview-document').waitFor({ timeout: 20000 });
  console.log('PASS: chat column layout on desktop, Chat tab conversation on phone.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
