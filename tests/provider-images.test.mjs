import assert from 'node:assert/strict';
import {generate} from '../src/lib/providers.ts';
const saved=globalThis.fetch;const bodies=[];
globalThis.fetch=async(url,init)=>{bodies.push(JSON.parse(init.body));return new Response(JSON.stringify(String(url).includes('generativelanguage')?{candidates:[{content:{parts:[{text:'ok'}]}}]}:{choices:[{message:{content:'ok'}}]}),{headers:{'content-type':'application/json'}});};
try{for(const type of ['openai','gemini'])await generate({provider:{type,baseUrl:type==='gemini'?'https://generativelanguage.googleapis.com/v1beta':'https://example.test/v1',apiKey:'test',useProxy:false},model:'test',system:'system',userText:'images',imageDataUrls:['data:image/png;base64,YQ==','data:image/jpeg;base64,Yg=='],temperature:0.2,signal:new AbortController().signal,onToken:()=>{}});
assert.equal(bodies[0].messages[1].content.length,3);assert.equal(bodies[1].contents[0].parts.length,3);assert.equal(bodies[1].contents[0].parts[2].inlineData.mimeType,'image/jpeg');console.log('PASS: OpenAI-compatible and Gemini multi-image payloads (mock fetch).');}finally{globalThis.fetch=saved;}
