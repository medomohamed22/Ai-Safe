import assert from 'node:assert/strict';
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};globalThis.window=new EventTarget();
const {generate}=await import('../src/lib/providers.ts');const {usage,POLICY_KEY,USAGE_KEY}=await import('../src/lib/usage.ts');
const provider={id:'test',type:'openai',name:'Test',apiKey:'PRIVATE_KEY_NOT_IN_LEDGER',baseUrl:'https://mock.example/v1',useProxy:false,models:[]};
const args={provider,model:'m',system:'private-source-content',userText:'private-user-content',temperature:.2,signal:new AbortController().signal,onToken:()=>{}};
localStorage.setItem(POLICY_KEY,JSON.stringify({maxRequests:5,maxTokens:100000,maxUsd:0,prices:{m:{input:2,output:4}}}));let calls=0,release;globalThis.fetch=async()=>{calls++;await new Promise(r=>release=r);return new Response(JSON.stringify({choices:[{message:{content:'result'}}],usage:{prompt_tokens:100,completion_tokens:25}}),{headers:{'content-type':'application/json'}});};
const pending=generate(args);await assert.rejects(()=>generate(args),/identical request/);assert.equal(calls,1);release();await pending;assert.equal(usage()[0].actual,true);assert.equal(usage()[0].input,100);assert.equal(usage()[0].output,25);assert.equal(usage()[0].cost,.0003);assert.ok(!JSON.stringify(usage()).includes('PRIVATE_KEY'));assert.ok(!JSON.stringify(usage()).includes('private-source'));
localStorage.setItem(POLICY_KEY,JSON.stringify({maxRequests:1,maxTokens:100000,maxUsd:0,prices:{}}));await assert.rejects(()=>generate({...args,userText:'different'}),/Request budget/);assert.equal(calls,1);
localStorage.setItem(USAGE_KEY,'[]');localStorage.setItem(POLICY_KEY,JSON.stringify({maxRequests:5,maxTokens:16384,maxUsd:0,prices:{}}));await assert.rejects(()=>generate(args),/token budget/);
localStorage.setItem(POLICY_KEY,JSON.stringify({maxRequests:5,maxTokens:100000,maxUsd:1,prices:{}}));await assert.rejects(()=>generate(args),/Configure model prices/);
// F1: failed and cancelled attempts are kept in the ledger but never count toward budgets.
localStorage.setItem(USAGE_KEY,JSON.stringify([{id:'f1',model:'m',provider:'test',started:1,duration:1,input:90000,output:90000,actual:false,cost:null,status:'failed'},{id:'c1',model:'m',provider:'test',started:1,duration:1,input:90000,output:90000,actual:false,cost:null,status:'cancelled'}]));
localStorage.setItem(POLICY_KEY,JSON.stringify({maxRequests:1,maxTokens:100000,maxUsd:0,prices:{}}));
globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:'ok'}}],usage:{prompt_tokens:10,completion_tokens:5}}),{headers:{'content-type':'application/json'}});};
await generate({...args,userText:'after failures'});assert.equal(usage().filter(r=>r.status==='done').length,1);
console.log('PASS feature 5: concurrent duplicate blocked, actual provider usage captured, per-model cost estimate, request/token/unpriced-dollar budgets block before network, no prompts or keys in ledger.');
