import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {build} from 'esbuild';import {parse} from '@babel/parser';
const catalog=JSON.parse(fs.readFileSync('src/lib/ar.json','utf8'));
let translated=0;const files=['src/App.tsx',...fs.readdirSync('src/components').filter(n=>n.endsWith('.tsx')).map(n=>'src/components/'+n)];
for(const file of files){const ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['typescript','jsx']});function visit(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee.name==='tr'&&n.arguments[0]?.type==='StringLiteral'){const key=n.arguments[0].value.trim();assert.ok(catalog[key],`${file}: missing Arabic translation for ${key}`);translated++;}if(n.type==='JSXText'&&/[A-Za-z]{2}/.test(n.value)&&!/^\s*[\w.-]+\.(jsx|tsx|json|html|css)\s*$/.test(n.value))assert.fail(`${file}: untranslated static UI text ${n.value}`);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}visit(ast);}
for(const [key,value]of Object.entries(catalog)){const placeholders=s=>[...s.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort();assert.deepEqual(placeholders(key),placeholders(value),`Interpolation mismatch: ${key}`);}
fs.mkdirSync('.qa',{recursive:true});await build({entryPoints:['src/lib/i18n.ts'],bundle:true,platform:'node',format:'cjs',outfile:'.qa/i18n-unit.cjs'});
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
globalThis.document={documentElement:{},querySelector:()=>null,title:''};
const i18n=createRequire(import.meta.url)(path.resolve('.qa/i18n-unit.cjs'));
assert.equal(i18n.getLanguage(),'en');assert.equal(i18n.tr('Settings'),'Settings');
let calls=0;const unsubscribe=i18n.subscribeLanguage(()=>calls++);i18n.setLanguage('ar');
assert.equal(document.documentElement.dir,'rtl');assert.equal(localStorage.getItem(i18n.LANGUAGE_KEY),'ar');assert.equal(i18n.tr('Settings'),'الإعدادات');
assert.equal(i18n.tr(' Delete {0} and its saved sketch/code? ',['Untouched user name']), ' هل تريد حذف Untouched user name مع الرسم والكود المحفوظين؟ ');
assert.equal(i18n.tr('Local save failed: Browser storage is full'), 'فشل الحفظ المحلي: Browser storage is full');
assert.equal(i18n.tr('User-defined text or source'),'User-defined text or source');
assert.equal(i18n.screenLabel({id:'custom',name:'Home'}),'Home');assert.equal(i18n.screenLabel({id:'home',name:'Home'}),'الرئيسية');
localStorage.setItem=()=>{throw new Error('Storage unavailable');};i18n.setLanguage('en');assert.equal(i18n.getLanguage(),'en');assert.equal(document.documentElement.dir,'ltr');assert.equal(calls,2);unsubscribe();
console.log(`PASS: ${Object.keys(catalog).length} Arabic messages, ${translated} static UI references covered, placeholders preserved, English default, persistent RTL switch, source/user text retained and storage-failure fallback.`);
