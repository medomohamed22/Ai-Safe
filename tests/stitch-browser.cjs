const {chromium,chromePath}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict');
const url=(process.env.S2UI_TEST_URL||'http://127.0.0.1:5173').split('#')[0];
(async()=>{
 const browser=await chromium.launch({executablePath:chromePath,headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'});page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let calls=[];
  await page.addInitScript(()=>{if(window.top!==window)return;if(!localStorage.getItem('s2ui.settings.v1'))localStorage.setItem('s2ui.settings.v1',JSON.stringify({providers:[{id:'p',type:'openai',name:'Test provider',apiKey:'test',baseUrl:'https://provider.example.test/v1',useProxy:false,models:[]}],activeProviderId:'p',activeModelId:'test',temperature:.2,autoSync:false,debounceMs:2000}));});
  await page.route('https://provider.example.test/**',r=>{calls.push(r.request().postDataJSON());return r.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:"import {useState} from 'react';export default function App(){const[n,setN]=useState(0);return <main><h1>Canvas design</h1><button onClick={()=>setN(n+1)}>Count</button><output>{n}</output></main>}"}}]})});});
  await page.goto(url);await page.getByRole('heading',{name:'What shall we design today?'}).waitFor();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('dialog',{name:'Settings',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Settings',exact:true}).waitFor({state:'hidden'});
  for(const width of [320,390,820,1440]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Home overflow at ${width}`);
   assert.ok(await page.getByRole('button',{name:'Create interface',exact:true}).isVisible());
  }
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({animations:'disabled',path:'tests/stitch-home-dark.png',fullPage:true});
  await page.getByRole('button',{name:'Switch to day mode',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.uiTheme==='light');await page.waitForTimeout(300);await page.screenshot({animations:'disabled',path:'tests/stitch-home-light.png',fullPage:true});
  await page.getByRole('button',{name:'A little more balance Mobile app · Prompt starter'}).click();
  assert.match(await page.getByLabel('Describe your new design').inputValue(),/habit tracker/);
  assert.equal(await page.getByRole('button',{name:'App',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByLabel('Describe your new design').fill('A counter with a reset action');
  await page.getByRole('button',{name:'Create interface',exact:true}).click();
  const frame=page.frameLocator('iframe[title="Live preview"]');await frame.getByRole('heading',{name:'Canvas design'}).waitFor();
  assert.equal(calls.length,1,'One home action must produce exactly one model request');
  assert.match(JSON.stringify(calls[0]),/Target platform: mobile app/);
  await frame.getByRole('button',{name:'Count',exact:true}).click();
  await page.getByRole('button',{name:'Focus drawing canvas',exact:true}).click();
  await page.getByRole('button',{name:'Focus interactive preview',exact:true}).click();
  assert.equal(await frame.locator('output').textContent(),'1','Canvas focus preserves interactive state');
  await page.getByRole('button',{name:'Back to projects',exact:true}).click();
  await page.getByRole('heading',{name:'What shall we design today?'}).waitFor();
  await page.getByLabel('Search projects').fill('A counter');await page.locator('.home-project-row').first().waitFor();
  assert.equal(await page.locator('.home-project-row').count(),1);await page.locator('.home-project-row').click();
  assert.equal(await frame.locator('output').textContent(),'1','Opening active project keeps current preview state');
  await page.getByRole('button',{name:'Switch to night mode',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.uiTheme==='dark');await page.waitForTimeout(300);await page.screenshot({animations:'disabled',path:'tests/stitch-editor-dark.png'});
  await page.getByRole('button',{name:'Back to projects',exact:true}).click();
  await page.getByRole('button',{name:'Blank project',exact:true}).click();
  await page.locator('.canvas-studio').waitFor({state:'visible'});assert.equal(await page.locator('iframe[title="Live preview"]').count(),0);
  await page.getByRole('button',{name:'Back to projects',exact:true}).click();await page.getByLabel('Search projects').fill('A counter');await page.locator('.home-project-row').click();
  await frame.getByRole('heading',{name:'Canvas design'}).waitFor();
  assert.equal(calls.length,1,'Opening a saved project must not regenerate');
  await page.getByRole('button',{name:'Back to projects',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({animations:'disabled',path:'tests/stitch-home-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Open studio',exact:true}).click();await page.getByRole('button',{name:'Show chat workspace',exact:true}).click();await page.screenshot({animations:'disabled',path:'tests/stitch-editor-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.getByRole('button',{name:'Send',exact:true}).locator('svg').last().isVisible(),true,'Phone send action has a visible arrow');
  assert.deepEqual(errors,[]);
  const fresh=await browser.newPage();fresh.setDefaultTimeout(60000);await fresh.goto(url);
  await fresh.getByLabel('Describe your new design').fill('Keep my unconfigured brief');await fresh.getByLabel('Describe your new design').press('Control+Enter');
  await fresh.getByRole('dialog',{name:'Settings',exact:true}).waitFor();await fresh.keyboard.press('Escape');await fresh.getByRole('dialog',{name:'Settings',exact:true}).waitFor({state:'hidden'});
  assert.match(await fresh.getByLabel('Describe your interface').inputValue(),/Keep my unconfigured brief/);
  await fresh.getByRole('button',{name:'Back to projects',exact:true}).click();await fresh.getByRole('button',{name:'Start with your design',exact:true}).click();
  await fresh.getByRole('dialog',{name:'Design reference',exact:true}).waitFor();await fresh.close();
  console.log('PASS: Stitch-inspired home at 320/390/820/1440, day/night, settings, starters/platform, one-shot generation, canvas state, project search/open/isolation, unconfigured brief retention and reference-first flow. Provider mocked.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

