const {chromium,chromePath}=require('./browser-runtime.cjs');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:chromePath,headless:true});try{
 const page=await browser.newPage();let request;
 await page.addInitScript(()=>localStorage.setItem('s2ui.settings.v1',JSON.stringify({providers:[{id:'p',type:'openai',name:'Test',apiKey:'local-test',baseUrl:'https://provider.example.test/v1',useProxy:false,models:[{id:'test',name:'Test',vision:true}]}],activeProviderId:'p',activeModelId:'test',temperature:0.2,autoSync:false,debounceMs:2000})));
 await page.route('https://provider.example.test/**',route=>{request=route.request().postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'```jsx\nexport default function App(){return <h1>Mock result</h1>}\n```'}}]})});});
 await page.goto(process.env.S2UI_TEST_URL || 'http://127.0.0.1:5173');await page.getByRole('button',{name:'Brand',exact:true}).click();await page.getByLabel('Brand name',{exact:true}).fill('Nile Studio');await page.getByLabel('Apply saved brand').check();await page.getByLabel('Brand direction').selectOption('rtl');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('footer input').fill('Build a landing page');await page.getByRole('button',{name:'Send',exact:true}).click();await page.frameLocator('iframe[title="Live preview"]').getByRole('heading',{name:'Mock result'}).waitFor({timeout:60000});
 assert.match(request.messages[0].content,/Nile Studio/);assert.match(request.messages[0].content,/"direction":"rtl"/);
 await page.reload();await page.getByRole('button',{name:'Brand',exact:true}).click();assert.equal(await page.getByLabel('Brand name',{exact:true}).inputValue(),'Nile Studio');assert.equal(await page.getByLabel('Brand direction').inputValue(),'rtl');
 console.log('PASS: saved brand settings persist and are included in the generation request. Provider response was mocked, not a real model quality test.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
