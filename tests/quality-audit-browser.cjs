const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P1-04: the quality audit must catch geometric phone failures that a plain
// page-width check passed — a fixed sidebar crushing content, clipped
// boxes, off-viewport actions — and must not flag a healthy layout.
async function auditWith(page, fixtureHtml) {
  return page.evaluate(async (html) => {
    const { auditDocument } = await import('/src/lib/quality.ts');
    const root = document.querySelector('#root');
    const saved = root.innerHTML;
    root.innerHTML = html;
    await new Promise(r => setTimeout(r, 120));
    const rows = auditDocument();
    root.innerHTML = saved;
    return Object.fromEntries(rows.map(r => [r.name, r]));
  }, fixtureHtml);
}
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/');
  const bad = await auditWith(page, `
    <aside style="position:fixed;left:0;top:0;width:250px;height:100vh;background:#ddd">Menu</aside>
    <main style="margin-left:250px;width:140px">
      <div style="width:200px;overflow:hidden"><div style="width:600px">Very wide content that cannot fit</div></div>
      <button style="position:absolute;left:500px;top:10px"> بعيد </button>
    </main>`);
  assert.equal(bad['Fixed overlay coverage'].passed, false, 'fixed sidebar covering the phone viewport is caught');
  assert.match(bad['Fixed overlay coverage'].detail, /covers \d+%/);
  assert.equal(bad['Content clipping'].passed, false, 'clipped content is caught');
  assert.equal(bad['Off-viewport actions'].passed, false, 'off-viewport action is caught');
  const good = await auditWith(page, `
    <main style="padding:12px">
      <h1>Tasks</h1>
      <div style="overflow-x:auto"><table style="width:700px"><tr><td>Scrollable table wrapper</td></tr></table></div>
      <button>Add task</button>
    </main>`);
  assert.equal(good['Fixed overlay coverage'].passed, true, JSON.stringify(good['Fixed overlay coverage']));
  assert.equal(good['Content clipping'].passed, true, JSON.stringify(good['Content clipping']));
  assert.equal(good['Off-viewport actions'].passed, true, JSON.stringify(good['Off-viewport actions']));
  console.log('PASS: geometric audit catches phone layout failures and passes a healthy layout.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
