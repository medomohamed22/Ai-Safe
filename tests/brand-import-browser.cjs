const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
// Design-system phase 5: import a brand identity from a website (through the
// app proxy), export the brand board and the whole design system as files,
// and restore the system from its file after the brand was changed.
const SITE = `<html><head><title>Acme Store | Shop</title><meta name="theme-color" content="#0ea5e9"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:'Cairo',sans-serif;color:#111827;background:#ffffff}.btn{background:#0ea5e9}</style></head><body>shop</body></html>`;
const URL = process.env.S2UI_TEST_URL || 'http://127.0.0.1:5174/#studio';
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/api/proxy?url=*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: SITE }));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Brand', exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Brand', exact: true }).click();
  await page.waitForSelector('[aria-label="Website address"]', { timeout: 15000 });
  await page.fill('[aria-label="Website address"]', 'https://acme.example/');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('s2ui.brand.v1') || '{}').primary === '#0ea5e9', null, { timeout: 15000 });
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('s2ui.brand.v1')));
  assert.equal(imported.name, 'Acme Store');
  assert.equal(imported.font, 'Cairo');

  const boardDownload = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: 'Export brand board' }).click();
  const boardPath = await (await boardDownload).path();
  assert.match(fs.readFileSync(boardPath, 'utf8'), /#0ea5e9/);

  const systemDownload = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: 'Export design system' }).click();
  const systemPath = await (await systemDownload).path();
  const system = JSON.parse(fs.readFileSync(systemPath, 'utf8'));
  assert.equal(system.format, 'sketch2ui-design-system');
  assert.equal(system.brand.primary, '#0ea5e9');

  await page.evaluate(() => { const b = JSON.parse(localStorage.getItem('s2ui.brand.v1')); b.primary = '#111111'; b.name = 'Scrambled'; localStorage.setItem('s2ui.brand.v1', JSON.stringify(b)); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Brand', exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Brand', exact: true }).click();
  await page.waitForSelector('[aria-label="Import design system"]', { timeout: 15000 });
  const tmpFile = '/tmp/design-system-import.json';
  fs.writeFileSync(tmpFile, JSON.stringify(system));
  await page.setInputFiles('[aria-label="Import design system"]', tmpFile);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('s2ui.brand.v1') || '{}').name === 'Acme Store', null, { timeout: 15000 });
  console.log('PASS: brand import — website identity import fills the brand, board and system files export, system import restores it.');
} finally { await browser.close(); } })().catch((error) => { console.error(error); process.exit(1); });
