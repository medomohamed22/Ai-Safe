const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
// Screen map upgrade: order badges, on-map link creation, sketch fallback
// previews for screens without code, and panel reordering. Seeded screens:
// A and B carry generated code and links; C starts empty and gets a sketch
// drawn in the studio so its card must show the sketch, never a blank box.
const project = { activeId: 'a', screens: [
  { id: 'a', name: 'Home', versions: ['export default function App(){return <h1>Alpha</h1>}'], vIndex: 0, scene: null },
  { id: 'b', name: 'Settings', versions: ['export default function App(){return <h1>Beta</h1>}'], vIndex: 0, scene: null },
  { id: 'c', name: 'SketchOnly', versions: [], vIndex: -1, scene: null },
], links: [{ from: 'a', to: 'b', label: 'Go settings' }] };
(async () => { const browser = await chromium.launch({ executablePath: chromePath, headless: true }); try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(value => { if (!localStorage.getItem('s2ui.project.v1')) localStorage.setItem('s2ui.project.v1', JSON.stringify(value)); }, project);
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173');
  // Give screen C a real sketch: open it, draw a rectangle, wait for autosave.
  await page.getByRole('button', { name: 'Screens (3)', exact: true }).click();
  await page.getByRole('button', { name: 'Open SketchOnly', exact: true }).click();
  const canvas = page.locator('.excalidraw').first();
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: 180, y: 150 } });
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 140, box.y + 120); await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 240); await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('s2ui.project.v1')).screens[2].scene?.elements?.length > 0);
  // Open the map from the screens panel.
  await page.getByRole('button', { name: 'Screens (3)', exact: true }).click();
  await page.getByRole('button', { name: 'Screen map', exact: true }).click();
  await page.locator('.map-card').first().waitFor();
  assert.equal(await page.locator('.map-card').count(), 3, 'three cards on the map');
  // Order badges follow the flow: Home 1, Settings 2, SketchOnly 3.
  const badges = await page.locator('.map-card .map-order').allInnerTexts();
  assert.deepEqual(badges.map(s => s.trim()), ['1', '2', '3'], 'flow order badges');
  // C has no code: its card shows the sketch image, not an iframe or blank.
  const cardC = page.locator('.map-card', { hasText: 'SketchOnly' });
  await cardC.locator('img.map-sketch-img').waitFor({ timeout: 20000 });
  assert.equal(await cardC.locator('iframe').count(), 0, 'sketch-only card has no live iframe');
  // Create a link on the map: Link screens -> Home -> SketchOnly, label it.
  await page.getByRole('button', { name: 'Link screens', exact: true }).click();
  await page.locator('.map-card', { hasText: 'Home' }).locator('.map-card-preview').click();
  await cardC.locator('.map-card-preview').click();
  await page.getByLabel('Navigation label').fill('Open sketch');
  await page.getByRole('button', { name: 'Save link', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('s2ui.project.v1')).links.length === 2);
  assert.ok(await page.locator('.map-edge').count() >= 2, 'both connectors drawn');
  // Auto-arrange is present and clickable without errors.
  await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click();
  await page.keyboard.press('Escape'); // leaves link mode first
  await page.keyboard.press('Escape'); // then closes the map
  // Reorder in the panel: move Home down, saved order must swap A and B.
  await page.getByRole('button', { name: 'Screens (3)', exact: true }).click();
  const firstRow = page.getByRole('dialog', { name: 'Screens and navigation' }).locator('li').first();
  await firstRow.getByRole('button', { name: 'Move down', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('s2ui.project.v1')).screens[0].id === 'b');
  console.log('PASS: screen map order badges, sketch fallback preview, on-map link creation, panel reorder.');
} finally { await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 1; });
