const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P2-03 in the panel: invalid input is stopped at the field with a friendly
// message and NO request leaves the browser; a valid link without a token
// flags the token field instead.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Test', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [{ id: 'test', name: 'Test', vision: true }] }], activeProviderId: 'p', activeModelId: 'test', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  await page.route('https://provider.example.test/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'export default function App(){return <h1>Figma fixture</h1>}' } }] }) }));
  let figmaCalls = 0;
  await page.route('https://api.figma.com/**', r => { figmaCalls++; return r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ err: 'Forbidden' }) }); });
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  const box = page.getByLabel('Describe your interface');
  await box.fill('figma fixture');
  await page.keyboard.press('Enter');
  await page.locator('.preview-document').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Productivity studio', exact: true }).click();
  await page.getByRole('button', { name: 'Figma', exact: true }).click();

  const read = page.getByRole('button', { name: 'Read Figma frame', exact: true });
  await read.click();
  await page.locator('#figma-url-error').waitFor({ timeout: 10000 });
  assert.match(await page.locator('#figma-url-error').textContent(), /Paste a Figma frame link first/);
  assert.equal(figmaCalls, 0, 'no request fires for an empty URL');
  assert.ok(!((await page.locator('.productivity-page').textContent()) || '').includes("Failed to construct"), 'the raw URL constructor error never reaches the user');

  await page.getByLabel('Figma frame URL').fill('https://www.figma.com/design/AbC123/Frame?node-id=42-7');
  await read.click();
  await page.locator('#figma-token-error').waitFor({ timeout: 10000 });
  assert.match(await page.locator('#figma-token-error').textContent(), /personal access token/);
  assert.equal(figmaCalls, 0, 'no request fires without a token');

  await page.getByLabel('Figma session token').fill('figd_test');
  await read.click();
  await page.getByText('Figma rejected the token or the file access.').waitFor({ timeout: 15000 });
  assert.equal(figmaCalls, 1, 'a valid form fires exactly one request, classified on failure');
  console.log('PASS: Figma validation stops bad input at the field; failures classify (auth vs network vs not found).');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
