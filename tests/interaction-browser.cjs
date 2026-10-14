const {chromium,chromePath}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict');
const fixture="import {useState} from 'react';export default function App(){const [n,setN]=useState(0),[q,setQ]=useState('');return <main><button onClick={()=>setN(n+1)}>Add</button><output>{n}</output><input aria-label='Search' value={q} onChange={e=>setQ(e.target.value)}/><p>{q}</p></main>}";
(async()=>{const browser=await chromium.launch({executablePath:chromePath,headless:true});try{
 const page=await browser.newPage();await page.addInitScript(code=>{localStorage.setItem('s2ui.versions.v1',JSON.stringify([code]));localStorage.setItem('s2ui.vindex.v1','0');},fixture);
 await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173');await page.getByRole('button',{name:'Test UI',exact:true}).click();
 const scenarios=[{name:'Counter updates',steps:[{action:'click',selector:'button'},{action:'expectText',selector:'output',value:'1'}]},{name:'Controlled search',steps:[{action:'fill',selector:'input',value:'Ada'},{action:'expectText',selector:'p',value:'Ada'}]},{name:'Deliberate failure',steps:[{action:'expectText',selector:'output',value:'999'}]}];
 await page.getByLabel('Test scenarios JSON').fill(JSON.stringify(scenarios));await page.getByRole('button',{name:'Run scenarios',exact:true}).click();
 const results=page.getByLabel('Test results');await results.getByText('FAIL — Deliberate failure:',{exact:false}).waitFor({timeout:60000});
 assert.match(await results.innerText(),/PASS — Counter updates/);assert.match(await results.innerText(),/PASS — Controlled search/);assert.match(await results.innerText(),/Expected text/);
 console.log('PASS: actual React click and controlled-input scenarios pass; deliberately incorrect expectation produces a detailed FAIL.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
