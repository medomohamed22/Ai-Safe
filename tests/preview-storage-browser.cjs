const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P1-01, the reported crash: generated code touching localStorage inside a
// sandboxed preview iframe (no allow-same-origin) threw a SecurityError and
// killed the alternative's preview. The document's storage guard must make
// the same access work, honor the editor seed, and post snapshots back.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/');
  await page.evaluate(async () => {
    const { buildPreviewHtml } = await import('/src/lib/preview.ts');
    const html = buildPreviewHtml('export default function App(){return null}', { token: 'tok-bridge', storageBridge: true, storageSeed: { seeded: 'from-editor' } });
    window.__storageMsgs = [];
    window.addEventListener('message', e => { if (e.data && e.data.source === 's2ui-preview' && e.data.type === 'storage') window.__storageMsgs.push(e.data); });
    const frame = document.createElement('iframe');
    frame.id = 'storage-probe';
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
  await page.waitForFunction(() => document.querySelector('#storage-probe'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const child = page.frames().find(f => f !== page.mainFrame());
  assert.ok(child, 'preview frame exists');
  const probe = await child.evaluate(() => {
    const out = {};
    out.seeded = localStorage.getItem('seeded');
    localStorage.setItem('task', 'write the report');
    out.readBack = localStorage.getItem('task');
    out.length = localStorage.length;
    localStorage.removeItem('task');
    out.afterRemove = localStorage.getItem('task');
    sessionStorage.setItem('tab', '3');
    out.session = sessionStorage.getItem('tab');
    return out;
  });
  assert.equal(probe.seeded, 'from-editor', 'the editor seed reaches the document store');
  assert.equal(probe.readBack, 'write the report', 'storage writes and reads work in the sandbox');
  assert.equal(probe.afterRemove, null, 'removeItem works');
  assert.equal(probe.session, '3', 'sessionStorage works too');
  await page.waitForFunction(() => window.__storageMsgs.length >= 1, null, { timeout: 5000 });
  const messages = await page.evaluate(() => window.__storageMsgs);
  assert.equal(messages[0].token, 'tok-bridge', 'snapshots carry the bridge token');
  assert.equal(messages[0].data.seeded, 'from-editor');
  console.log('PASS: sandboxed preview storage works, honors the seed, and bridges snapshots back.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
