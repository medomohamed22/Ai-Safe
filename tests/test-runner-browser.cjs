const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P1-02 + P1-03 acceptance, against the REAL interaction test runner and a
// hand-built Arabic tasks app: the reported has-text selector must work, a
// wrong expectation must FAIL (not pass), and broken selectors must classify
// as setup errors — never as app failures. The runner and the app share one
// document here because a sandboxed srcdoc frame cannot import the dev
// module cross-origin; the runner's source check (event source === parent)
// holds because the page posts to itself.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/');
  const results = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <input name="title" aria-label="Task title" />
      <button id="t-add">إضافة مهمة</button>
      <button id="t-save">حفظ</button>
      <button id="t-save-draft">حفظ كمسودة</button>
      <span id="t-marker"></span>
      <p id="t-empty">لا توجد مهام بعد</p>
      <ul id="t-tasks"></ul>
      <span id="t-count">0</span>`;
    document.body.appendChild(host);
    const tasks = [];
    host.querySelector('#t-add').addEventListener('click', () => {
      const input = host.querySelector('input[name=title]');
      if (!input.value) return;
      tasks.push(input.value);
      const li = document.createElement('li'); li.textContent = input.value;
      host.querySelector('#t-tasks').appendChild(li);
      host.querySelector('#t-count').textContent = String(tasks.length);
      host.querySelector('#t-empty').style.display = 'none';
      input.value = '';
    });
    host.querySelector('#t-save').addEventListener('click', () => { host.querySelector('#t-marker').textContent = 'saved-exact'; });
    host.querySelector('#t-save-draft').addEventListener('click', () => { host.querySelector('#t-marker').textContent = 'saved-draft'; });
    const { installTestRunner } = await import('/src/lib/interactionTests.ts');
    installTestRunner('tok-runner');
    const scenarios = [
      { name: 'Add task via has-text', steps: [
        { action: 'fill', selector: 'input[name=title]', value: 'مراجعة التصميم' },
        { action: 'click', selector: "button:has-text('إضافة مهمة')" },
        { action: 'expectText', selector: '#t-tasks', value: 'مراجعة التصميم' },
        { action: 'expectText', selector: '#t-count', value: '1' },
      ] },
      { name: 'Deliberately wrong expectation', steps: [
        { action: 'expectText', selector: '#t-tasks', value: 'مهمة غير موجودة' },
      ] },
      { name: 'Invalid CSS selector', steps: [
        { action: 'click', selector: 'div >> span' },
        { action: 'exists', selector: '#t-tasks' },
      ] },
      { name: 'Malformed has-text', steps: [
        { action: 'click', selector: 'button:has-text(حفظ)' },
        { action: 'exists', selector: '#t-tasks' },
      ] },
      { name: 'Multiple text matches pick the tightest', steps: [
        { action: 'click', selector: "button:has-text('حفظ')" },
        { action: 'expectText', selector: '#t-marker', value: 'saved-exact' },
      ] },
    ];
    const reply = new Promise(resolve => {
      const h = e => { if (e.data && e.data.source === 's2ui-tests') { window.removeEventListener('message', h); resolve(e.data.results); } };
      window.addEventListener('message', h);
      setTimeout(() => resolve(null), 30000);
    });
    window.postMessage({ type: 'run-tests', token: 'tok-runner', scenarios }, '*');
    return reply;
  });
  assert.ok(results, 'the runner replied');
  const byName = Object.fromEntries(results.map(r => [r.name, r]));
  assert.equal(byName['Add task via has-text'].status, 'passed', JSON.stringify(byName['Add task via has-text']));
  assert.equal(byName['Deliberately wrong expectation'].status, 'failed', 'a wrong expectation must fail (P1-03)');
  assert.equal(byName['Invalid CSS selector'].status, 'setup-error', 'invalid CSS is a setup error, not an app failure');
  assert.equal(byName['Malformed has-text'].status, 'setup-error');
  assert.equal(byName['Multiple text matches pick the tightest'].status, 'passed');
  console.log('PASS: has-text works, wrong expectations fail, broken selectors classify as setup errors.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
