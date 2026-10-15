import arabic from './ar.json';
export type Language = 'en' | 'ar';
export const LANGUAGE_KEY = 's2ui.language.v1';
let language:Language='en';
try { language=localStorage.getItem(LANGUAGE_KEY)==='ar'?'ar':'en'; } catch { /* English is the first-visit default. */ }
const listeners=new Set<()=>void>();
export const getLanguage=()=>language;
export const subscribeLanguage=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function setLanguage(next:Language){
 language=next;
 try{localStorage.setItem(LANGUAGE_KEY,next);}catch{/* Switching still works without storage. */}
 applyLanguage();listeners.forEach(listener=>listener());
}
export function applyLanguage(){
 if(typeof document==='undefined')return;
 document.documentElement.lang=language;
 document.documentElement.dir=language==='ar'?'rtl':'ltr';
 document.title=language==='ar'?'Sketch2UI — من الفكرة إلى الواجهة':'Sketch2UI — Ideas into interfaces';
 document.querySelector('meta[name="description"]')?.setAttribute('content',language==='ar'?'ارسم واجهتك، ثم أنشئها وطوّرها وصدّر كودًا تفاعليًا.':'Sketch your next interface. Generate, refine, and export interactive frontends.');
}
const dictionary=arabic as Record<string,string>;
const patterns=Object.entries(dictionary).filter(([key])=>/\{\d+\}/.test(key)).map(([key,value])=>{
 const indexes:number[]=[];
 const expression=key.split(/(\{\d+\})/).map(part=>{const match=part.match(/^\{(\d+)\}$/);if(match){indexes.push(Number(match[1]));return '(.+?)';}return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('');
 return {match:new RegExp('^'+expression+'$','s'),value,indexes};
});
// Keep source strings canonical; language never changes API/schema identifiers.
export function tr(value:unknown,values:readonly unknown[]=[]):string{
 const source=value==null?'':String(value);
 const key=source.trim();
 let translated=source;
 if(language==='ar'){
  if(dictionary[key]!==undefined)translated=source.slice(0,source.indexOf(key))+dictionary[key]+source.slice(source.indexOf(key)+key.length);
  else if(!values.length&&source.length<4096){
   for(const pattern of patterns){const match=key.match(pattern.match);if(!match)continue;translated=pattern.value.replace(/\{(\d+)\}/g,(token,index)=>{const slot=pattern.indexes.indexOf(Number(index));const item=match[slot+1];return item===undefined?token:(dictionary[item]||item);});break;}
  }
 }
 return translated.replace(/\{(\d+)\}/g,(match,index)=>Number(index)<values.length?String(values[Number(index)]??''):match);
}
export const locale=()=>getLanguage()==='ar'?'ar-EG':'en-US';
export const screenLabel=(screen:{id:string;name:string})=>screen.id==='home'&&screen.name==='Home'?tr('Home'):screen.name;
export const workspaceLabel=(name:string)=>['Untitled project','Untitled design'].includes(name)?tr(name):name;
