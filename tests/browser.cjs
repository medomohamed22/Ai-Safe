const { chromium, chromePath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
const fixture = `import {useState} from 'react'; export default function App(){const [n,setN]=useState(0);return <main><h1>Hello</h1><button onClick={()=>setN(n+1)}>Add</button><output>{n}</output></main>}`;
(async () => {
 const browser = await chromium.launch({ executablePath: chromePath, headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript((code) => { if (!localStorage.getItem('s2ui.versions.v1')) { localStorage.setItem('s2ui.versions.v1',JSON.stringify([code]));localStorage.setItem('s2ui.vindex.v1','0'); } }, fixture);
  await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173');
  const frame = page.frameLocator('iframe[title="Live preview"]');
  await frame.getByRole('heading', {name:'Hello'}).waitFor({timeout:60000});
  await page.getByRole('button', { name: 'Select element' }).click();
  await frame.getByRole('button', {name:'Add',exact:true}).click();
  assert.equal(await frame.locator('output').textContent(), '0', 'Selection must not invoke click handler');
  await page.getByLabel('Element text', {exact:true}).fill('Save');
  await page.getByLabel('Padding', {exact:true}).fill('16');
  await page.getByRole('button',{name:'Apply to code'}).click();
  await frame.getByRole('button',{name:'Save',exact:true}).waitFor();
  await page.getByRole('button',{name:'Select element'}).click();
  await frame.getByRole('button',{name:'Save',exact:true}).click();
  assert.equal(await frame.locator('output').textContent(),'1','Handler must still work after editing');
  assert.equal(await frame.getByRole('button',{name:'Save',exact:true}).evaluate(el=>getComputedStyle(el).padding),'16px');
  await page.getByRole('button',{name:'Previous version'}).click();
  await frame.getByRole('button',{name:'Add',exact:true}).waitFor();
  await page.getByRole('button',{name:'Next version'}).click();
  await frame.getByRole('button',{name:'Save',exact:true}).waitFor();
  await page.reload();
  await frame.getByRole('button',{name:'Save',exact:true}).waitFor();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button',{name:'Project ZIP',exact:true}).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(),'sketch2ui-project.zip');
  await download.saveAs('.qa/browser-export.zip');
  await page.screenshot({path:'tests/visual-editor.png'});
  console.log('PASS: real browser selection, event suppression, JSX apply, styles, preserved click behavior, undo/redo, persisted reload, ZIP download.');
 } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
