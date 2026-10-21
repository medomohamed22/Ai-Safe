const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// P3-06: switching to a screen whose sketch sits far from the origin must
// fit it into view (before, the canvas kept the previous screen's pan/zoom
// and sketches could open off-screen), and the screen map's Fit view
// restores the fitted view after zooming.
const rect = { id: 'far1', type: 'rectangle', x: 4000, y: 3000, width: 240, height: 140, angle: 0, strokeColor: '#1e1e1e', backgroundColor: '#ced4da', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: { type: 3 }, seed: 12345, version: 1, versionNonce: 1, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, points: undefined, customData: undefined };
const project = { activeId: 'home', screens: [
  { id: 'home', name: 'Home', versions: ['export default function App(){return <h1>Home</h1>}'], vIndex: 0, scene: null },
  { id: 'far', name: 'FarSketch', versions: [], vIndex: -1, scene: { elements: [rect], files: {} } },
], links: [] };
async function nonWhitePixels(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.excalidraw canvas')].filter(c => c.width > 100);
    if (!canvases.length) return -1;
    const c = canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const probe = document.createElement('canvas'); probe.width = c.width; probe.height = c.height;
    const ctx = probe.getContext('2d'); ctx.drawImage(c, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < data.length; i += 16) if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) n++;
    return n;
  });
}
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(value => { if (!localStorage.getItem('s2ui.project.v1')) localStorage.setItem('s2ui.project.v1', JSON.stringify(value)); }, project);
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173/#studio');
  await page.locator('.excalidraw').first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'Screens (2)', exact: true }).click();
  await page.getByRole('button', { name: 'Open FarSketch', exact: true }).click();
  await page.waitForTimeout(1500);
  const filled = await nonWhitePixels(page);
  assert.ok(filled > 40, `the far-away sketch is fitted into view (non-white samples: ${filled})`);

  // Screen map: zoom in, then Fit view restores the fitted percentage.
  await page.getByRole('button', { name: 'Screens (2)', exact: true }).click();
  await page.getByRole('button', { name: 'Screen map', exact: true }).click();
  await page.locator('.map-card').first().waitFor({ timeout: 15000 });
  const pct = page.getByRole('button', { name: 'Fit view' }).first();
  const fittedPct = (await pct.textContent()).trim();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForFunction(label => document.querySelector('.screen-map-pct')?.textContent?.trim() !== label, fittedPct, { timeout: 8000 });
  await pct.click();
  await page.waitForFunction(label => document.querySelector('.screen-map-pct')?.textContent?.trim() === label, fittedPct, { timeout: 8000 });
  console.log('PASS: screen switch fits the sketch; map Fit view restores the fitted zoom.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
