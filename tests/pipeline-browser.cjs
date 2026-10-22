const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// The visible production line: a run names its stages in the chat thread
// (badged with the model that did the work), the finished summary stays on
// the built reply, and Plan-first pauses the run at an approval gate.
const BASE = { providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 };
const REPLY = { choices: [{ message: { content: 'export default function App(){return <h1>Pipeline works</h1>}' } }] };
const PLAN_REPLY = { choices: [{ message: { content: JSON.stringify({ summary: 'Drafted plan summary', requirements: [{ text: 'First requirement' }, { text: 'Second requirement' }] }) } }] };
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  // A: plain run — the built reply carries the stage summary.
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), BASE);
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(REPLY) }));
  await page.goto(URL);
  await page.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByLabel('Describe your interface').fill('build a pipeline test page');
  await page.locator('.chat-column .send-button').click();
  const built = page.locator('.chat-msg.ai.built');
  await built.waitFor({ timeout: 20000 });
  const summary = await built.locator('.chat-stages-summary').textContent();
  for (const label of ['Build', 'Review', 'Ship']) assert.ok(summary.includes(label), `the stage summary names ${label}`);
  assert.ok(summary.includes('source checks passed'), 'the review stage reports the source checks');
  assert.ok(summary.includes('No plan for this screen'), 'the plan stage honestly reports the missing plan');

  // B: Plan-first with a seeded draft — the gate pauses, approval resumes.
  const gate = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const gateSettings = { ...BASE, planFirst: true };
  const draft = { summary: 'Seeded draft plan', requirements: [{ id: 'r0', text: 'Seeded requirement', verified: false }], approved: false };
  await gate.addInitScript(([s, d]) => { localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)); localStorage.setItem('s2ui.plan.home', JSON.stringify(d)); }, [gateSettings, draft]);
  await gate.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(REPLY) }));
  await gate.goto(URL);
  await gate.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await gate.getByLabel('Describe your interface').fill('gated build please');
  await gate.locator('.chat-column .send-button').click();
  await gate.locator('.plan-gate', { hasText: 'Seeded draft plan' }).waitFor({ timeout: 15000 });
  assert.equal(await gate.locator('.chat-msg.ai.built').count(), 0, 'nothing builds before the plan is approved');
  await gate.getByRole('button', { name: 'Approve plan & build' }).click();
  await gate.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });
  const savedPlan = await gate.evaluate(() => JSON.parse(localStorage.getItem('s2ui.plan.home')));
  assert.equal(savedPlan.approved, true, 'approving in the gate approves the stored plan');

  // C: Plan-first with no plan — one is drafted, then the user may skip it.
  const auto = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await auto.addInitScript(s => localStorage.setItem('s2ui.settings.v1', JSON.stringify(s)), gateSettings);
  let calls = 0;
  await auto.route('https://provider.example.test/**', r => { calls += 1; r.fulfill({ contentType: 'application/json', body: JSON.stringify(calls === 1 ? PLAN_REPLY : REPLY) }); });
  await auto.goto(URL);
  await auto.locator('.chat-column').waitFor({ state: 'visible', timeout: 15000 });
  await auto.getByLabel('Describe your interface').fill('draft me a plan');
  await auto.locator('.chat-column .send-button').click();
  await auto.locator('.plan-gate', { hasText: 'Drafted plan summary' }).waitFor({ timeout: 15000 });
  await auto.getByRole('button', { name: 'Build without a plan' }).click();
  await auto.locator('.chat-msg.ai.built').waitFor({ timeout: 20000 });
  const autoSummary = await auto.locator('.chat-msg.ai.built .chat-stages-summary').textContent();
  assert.ok(autoSummary.includes('Continued without a plan'), 'skipping the gate is recorded honestly in the summary');
  console.log('PASS: pipeline timeline, plan gate approval, and auto-draft + skip.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
