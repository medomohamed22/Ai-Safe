const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P1-06: the Quality tab probes the build service up front. Against the
// full local stack (server.mjs) it must report AVAILABLE; against the
// editor-only dev server it must honestly report UNAVAILABLE (the bundle
// check is then marked blocked, never failed).
async function probe(page, url) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Productivity studio', exact: true }).click();
  const status = page.getByRole('status').filter({ hasText: 'Build service' });
  await status.waitFor({ timeout: 20000 });
  // The probe compiles a real (tiny) bundle server-side; wait out the
  // 'Checking…' state before reading the verdict.
  await page.waitForFunction(() => { const el = [...document.querySelectorAll('[role=status]')].find(n => (n.textContent || '').includes('Build service')); return el && !el.textContent.includes('Checking'); }, null, { timeout: 60000 });
  return (await status.textContent()).trim();
}
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const full = await probe(page, process.env.S2UI_FULL_URL || 'http://127.0.0.1:5175/#studio');
  assert.match(full, /is available/, `full stack should report the service available, got: ${full}`);
  await page.keyboard.press('Escape');
  const editorOnly = await probe(page, process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  assert.match(editorOnly, /not available.*blocked, not failed/, `editor-only should report blocked honestly, got: ${editorOnly}`);
  console.log('PASS: build-service health is reported accurately on both deployments.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
