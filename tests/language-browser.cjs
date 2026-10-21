const {chromium,chromePath}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict');const ar=require('../src/lib/ar.json');
const t=key=>ar[key]||key;const base=(process.env.S2UI_TEST_URL||'http://127.0.0.1:5175').split('#')[0];
(async()=>{const browser=await chromium.launch({executablePath:chromePath,headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'});page.setDefaultTimeout(60000);
 await page.goto(base);assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
 await page.getByLabel('Describe your new design').fill('Keep this home draft');await page.getByRole('button',{name:'العربية',exact:true}).click();
 assert.match(await page.locator('html').getAttribute('lang'),/^ar(?:-|$)/);assert.equal(await page.getByLabel(t('Describe your new design')).inputValue(),'Keep this home draft');
 await page.getByRole('heading',{name:'ماذا تريد أن نصمّم اليوم؟'}).waitFor();
 for(const width of [320,390,820,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Arabic home overflow ${width}`);}
 await page.screenshot({path:'tests/language-home-ar.png',fullPage:true,animations:'disabled'});
 await page.reload();assert.match(await page.locator('html').getAttribute('lang'),/^ar(?:-|$)/);
 await page.getByRole('button',{name:t('Open studio'),exact:true}).click();
 await page.getByRole('button',{name:t('Productivity studio'),exact:true}).click();const productivity=page.getByRole('dialog',{name:t('Productivity studio'),exact:true});
 for(const key of ['Quality','Plan','Library','Visual compare','Usage','Import project','Review','Figma','Video','Projects']){
  await productivity.getByRole('button',{name:t(key),exact:true}).click();
  for(const width of [320,390,820,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Arabic ${key} overflow ${width}`);}
 }
 await page.screenshot({path:'tests/language-projects-ar.png',animations:'disabled'});await page.keyboard.press('Escape');await productivity.waitFor({state:'hidden'});
 for(const [button,dialog]of [['Brand','Brand identity'],['Reference','Design reference'],['Backend','Backend connection'],['Screens (1)','Screens and navigation']]){
  await page.getByRole('button',{name:button==='Screens (1)'?'الشاشات (1)':t(button),exact:true}).click();
  const modal=page.getByRole('dialog',{name:t(dialog),exact:true});await modal.waitFor();
  if(button==='Brand') {await page.getByLabel(t('Brand direction')).selectOption('rtl');assert.equal(await page.getByLabel(t('Brand direction')).inputValue(),'rtl');await page.getByLabel(t('Brand direction')).selectOption('ltr');}
  await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
 }
 await page.getByRole('button',{name:t('Settings'),exact:true}).click();const settings=page.getByRole('dialog',{name:t('Settings'),exact:true});await settings.getByRole('button',{name:t('OpenAI-compatible'),exact:true}).click();await page.screenshot({path:'tests/language-settings-ar.png',animations:'disabled'});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:t('Back to projects'),exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tests/language-home-ar-mobile.png',fullPage:true,animations:'disabled'});
 const editor=await browser.newPage({viewport:{width:1440,height:1000}});editor.setDefaultTimeout(60000);
 await editor.addInitScript(()=>{if(window.top!==window)return;localStorage.setItem('s2ui.versions.v1',JSON.stringify(["import {useState} from 'react';export default function App(){const[n,setN]=useState(0);return <main><h1>Unchanged user content</h1><button onClick={()=>setN(n+1)}>Count</button><output>{n}</output></main>}" ]));localStorage.setItem('s2ui.vindex.v1','0');});
 await editor.goto(base+'#studio');const frame=editor.frameLocator('iframe[title="Live preview"]');await frame.getByRole('button',{name:'Count',exact:true}).click();await editor.getByLabel('Describe your interface').fill('Keep the editor draft');const source=await editor.evaluate(()=>localStorage.getItem('s2ui.versions.v1'));
 await editor.getByRole('button',{name:'العربية',exact:true}).click();const arFrame=editor.frameLocator('iframe[title="'+t('Live preview')+'"]');assert.equal(await arFrame.locator('output').textContent(),'1');assert.equal(await editor.getByLabel(t('Describe your interface')).inputValue(),'Keep the editor draft');
 const separator=editor.getByRole('separator',{name:t('Resize drawing and preview')});await separator.focus();await editor.keyboard.press('ArrowLeft');assert.equal(await separator.getAttribute('aria-valuenow'),'42');
 await editor.getByRole('button',{name:t('Expand preview'),exact:true}).click();
 await editor.getByRole('button',{name:t('Select element'),exact:true}).click();await arFrame.getByRole('heading',{name:'Unchanged user content'}).click();await editor.getByRole('region',{name:t('Element editor')}).waitFor();await editor.getByRole('button',{name:t('Close element editor')}).click();await editor.getByRole('button',{name:t('Select element'),exact:true}).click();
 await editor.locator('.export-menu>summary').click();await editor.getByRole('button',{name:t('Project ZIP'),exact:true}).waitFor();await editor.keyboard.press('Escape');
 await editor.getByRole('button',{name:t('Share / review'),exact:true}).click();await editor.getByRole('button',{name:t('Create review link'),exact:true}).click();const link=await editor.getByLabel(t('Review link'),{exact:true}).inputValue();
 const reviewer=await browser.newPage();await reviewer.goto(link);await reviewer.getByRole('button',{name:'العربية',exact:true}).click();await reviewer.getByRole('heading',{name:t('Sketch2UI Review')}).waitFor();await reviewer.frameLocator('iframe[title="'+t('Review preview')+'"]').getByRole('heading',{name:'Unchanged user content'}).waitFor();await reviewer.close();
 await editor.keyboard.press('Escape');await editor.getByRole('button',{name:'English',exact:true}).click();assert.equal(await frame.locator('output').textContent(),'1');assert.equal(await editor.evaluate(()=>localStorage.getItem('s2ui.versions.v1')),source,'Language does not rewrite generated code');
 await editor.getByRole('button',{name:'العربية',exact:true}).click();await editor.setViewportSize({width:320,height:740});await editor.getByRole('button',{name:t('Show chat workspace')}).click();assert.ok(await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await editor.screenshot({path:'tests/language-editor-ar-mobile.png',animations:'disabled'});
 console.log('PASS: English default, AR/EN persistence and RTL, all 10 Arabic productivity tabs at four widths, translated dialogs/exports/review, canonical direction values, split keyboard behavior, preserved drafts and interactive source.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
