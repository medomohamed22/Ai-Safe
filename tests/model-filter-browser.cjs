const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P3-02: with a mixed provider list, the model picker defaults to models
// suited to UI generation, says how many it hid, and reveals everything
// (with media chips) when the filter is turned off.
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('s2ui.settings.v1', JSON.stringify({ providers: [{ id: 'p', type: 'openai', name: 'Mixed', apiKey: 'test', baseUrl: 'https://provider.example.test/v1', useProxy: false, models: [
    { id: 'chat-pro-1', name: 'Chat Pro 1', vision: true },
    { id: 'dall-e-3', name: 'DALL-E 3', vision: false },
    { id: 'whisper-1', name: 'Whisper 1', vision: false },
    { id: 'text-embedding-3-small', name: 'Embedding 3', vision: false },
  ] }], activeProviderId: 'p', activeModelId: 'chat-pro-1', temperature: 0.2, autoSync: false, autoSegment: false, autoImages: false, debounceMs: 2000 })));
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  await page.locator('.model-slot button').first().click();
  const popover = page.locator('.model-popover');
  await popover.waitFor({ timeout: 15000 });
  assert.equal(await popover.locator('.model-option').count(), 1, 'only the code model is offered by default');
  await popover.getByText('3 media or utility models hidden by the filter').waitFor({ timeout: 8000 });
  await popover.getByLabel('Show only models suited to UI generation').uncheck();
  assert.equal(await popover.locator('.model-option').count(), 4, 'turning the filter off reveals every model');
  assert.equal(await popover.locator('.model-media-chip').count(), 3, 'media models carry a visible chip when shown');
  await popover.locator('.model-option', { hasText: 'whisper-1' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('s2ui.settings.v1')).activeModelId === 'whisper-1', null, { timeout: 8000 });
  console.log('PASS: picker hides media models by default with an honest count, reveals them on demand.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
