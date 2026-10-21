const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
// Item 15: a published (#app=) link for an Arabic design must open as an RTL
// document with the Arabic font, exactly as the share recipient will see it.
function encodeBundle(bundle) {
  return gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const bundle = { version: 1, screens: [{ id: 's1', name: 'لوحة التحكم', code: 'export default function App(){return <main><h1>لوحة التحكم</h1><p>إجمالي المبيعات اليوم</p></main>}' }], backend: { mode: 'demo', baseUrl: '', endpoints: [] } };
  await page.goto((process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/').replace('#studio', '') + '#app=' + encodeBundle(bundle));
  const frame = page.locator('iframe[title]').first();
  await frame.waitFor({ timeout: 20000 });
  const srcDoc = await frame.getAttribute('srcDoc');
  assert.ok(srcDoc.includes('<html lang="ar" dir="rtl">'), 'published document is rtl');
  assert.ok(srcDoc.includes('family=Cairo'), 'published document loads the Arabic font');
  console.log('PASS: published Arabic app opens as an RTL document with Cairo.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
