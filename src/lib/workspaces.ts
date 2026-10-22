import {load,save} from './storage';
export const ACTIVE_WORKSPACE='s2ui.active-workspace.v1';
export interface WorkspaceSnapshot {version:1;entries:Record<string,unknown>}
export interface WorkspaceRecord {id:string;name:string;updatedAt:number;snapshot:WorkspaceSnapshot;cloudVersion:number}
const exact=new Set(['s2ui.project.v1','s2ui.scene.v1','s2ui.versions.v1','s2ui.vindex.v1','s2ui.backend.v1','s2ui.brand.v1','s2ui.reference.v1','s2ui.alternatives.v1','s2ui.locks.v1','s2ui.tests.v1','s2ui.components.v1','s2ui.assets.v1','s2ui.imported.v1']);
export const workspaceKey=(key:string)=>exact.has(key)||/^s2ui\.plan\.[\w-]+$/.test(key);
export function validateSnapshot(value:unknown):WorkspaceSnapshot{
 const s=value as WorkspaceSnapshot;if(!s||s.version!==1||!s.entries||typeof s.entries!=='object'||Array.isArray(s.entries)||JSON.stringify(s).length>8000000)throw new Error('Invalid workspace backup (maximum 8 MB).');
 for(const key of Object.keys(s.entries))if(!workspaceKey(key))throw new Error(`Backup contains a non-project key: ${key}`);
 const object=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v);
 for(const key of ['s2ui.backend.v1','s2ui.brand.v1','s2ui.alternatives.v1','s2ui.locks.v1','s2ui.assets.v1','s2ui.imported.v1'])if(key in s.entries&&!object(s.entries[key]))throw new Error(`Invalid project object: ${key}`);
 const versions=s.entries['s2ui.versions.v1'];if(versions!==undefined&&(!Array.isArray(versions)||versions.some(v=>typeof v!=='string')))throw new Error('Invalid code history.');
 const library=s.entries['s2ui.components.v1'];if(library!==undefined&&(!Array.isArray(library)||library.length>30||library.some((c:any)=>!object(c)||typeof c.name!=='string'||typeof c.code!=='string'||typeof c.description!=='string')))throw new Error('Invalid component library.');
 const assets=s.entries['s2ui.assets.v1'] as any;if(assets&&Object.values(assets).some((a:any)=>!object(a)||typeof a.name!=='string'||typeof a.dataUrl!=='string'||!a.dataUrl.startsWith('data:image/')))throw new Error('Invalid design assets.');
 for(const key of ['s2ui.locks.v1','s2ui.alternatives.v1'])if(s.entries[key]&&Object.values(s.entries[key] as object).some(v=>!Array.isArray(v)))throw new Error('Invalid screen metadata.');
 if('s2ui.tests.v1' in s.entries&&typeof s.entries['s2ui.tests.v1']!=='string')throw new Error('Invalid test scenarios.');
 for(const [key,value]of Object.entries(s.entries))if(key.startsWith('s2ui.plan.')){const plan=value as any;if(!object(plan)||typeof plan.summary!=='string'||typeof plan.approved!=='boolean'||!Array.isArray(plan.requirements)||plan.requirements.some((r:any)=>!object(r)||typeof r.id!=='string'||typeof r.text!=='string'||typeof r.verified!=='boolean'))throw new Error('Invalid saved plan.');}
 if('s2ui.vindex.v1' in s.entries&&!Number.isInteger(s.entries['s2ui.vindex.v1']))throw new Error('Invalid version index.');
 const backend=s.entries['s2ui.backend.v1'] as any;if(backend&&(!['demo','http'].includes(backend.mode)||typeof backend.baseUrl!=='string'||!Array.isArray(backend.endpoints)))throw new Error('Invalid backend configuration.');
 const brand=s.entries['s2ui.brand.v1'] as any;if(brand&&(typeof brand.enabled!=='boolean'||['name','primary','secondary','background','text','font','logo'].some(k=>typeof brand[k]!=='string')||!Number.isFinite(brand.radius)||!['ltr','rtl'].includes(brand.direction)))throw new Error('Invalid brand configuration.');
 const scene=(v:any)=>v===null||object(v)&&Array.isArray(v.elements)&&v.elements.every((e:any)=>object(e)&&typeof e.id==='string'&&typeof e.type==='string');
 if('s2ui.scene.v1' in s.entries&&!scene(s.entries['s2ui.scene.v1']))throw new Error('Invalid drawing scene.');
 const p=s.entries['s2ui.project.v1'] as any;if('s2ui.project.v1' in s.entries&&(!object(p)||!Array.isArray(p.screens)||!p.screens.length||p.screens.length>30||!Array.isArray(p.links)||!p.screens.some((x:any)=>x.id===p.activeId)||p.screens.some((x:any)=>!object(x)||typeof x.id!=='string'||typeof x.name!=='string'||!Array.isArray(x.versions)||x.versions.some((v:any)=>typeof v!=='string')||!Number.isInteger(x.vIndex)||x.vIndex < -1||x.vIndex >= x.versions.length||!scene(x.scene))))throw new Error('Invalid project screens.');
 return s;
}
export function snapshotWorkspace():WorkspaceSnapshot{const entries:Record<string,unknown>={};for(const key of Object.keys(localStorage))if(workspaceKey(key)){try{entries[key]=JSON.parse(localStorage.getItem(key)!);}catch{throw new Error(`Cannot back up malformed project data: ${key}`);}}return validateSnapshot({version:1,entries});}
export function restoreSnapshot(snapshot:WorkspaceSnapshot){validateSnapshot(snapshot);const previous=snapshotWorkspace();const apply=(s:WorkspaceSnapshot)=>{for(const key of Object.keys(localStorage))if(workspaceKey(key))localStorage.removeItem(key);for(const [key,value]of Object.entries(s.entries))localStorage.setItem(key,JSON.stringify(value));};try{apply(snapshot);}catch(e){apply(previous);throw new Error('Browser storage is full; restore was rolled back. Download a backup and reduce embedded assets.');}}
let database:Promise<IDBDatabase>|undefined;
const db=()=>database??=new Promise((resolve,reject)=>{const request=indexedDB.open('sketch2ui-workspaces',1);request.onupgradeneeded=()=>request.result.createObjectStore('projects',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>{database=undefined;reject(request.error);};});
async function operation<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const connection=await db();return new Promise((resolve,reject)=>{const transaction=connection.transaction('projects',mode);const request=fn(transaction.objectStore('projects'));let result:T;request.onsuccess=()=>{result=request.result;};transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('Workspace storage aborted'));});}
export const listWorkspaces=async()=>((await operation('readonly',s=>s.getAll())) as WorkspaceRecord[]).sort((a,b)=>b.updatedAt-a.updatedAt);
export const getWorkspace=async(id:string)=>(await operation('readonly',s=>s.get(id))) as WorkspaceRecord|undefined;
export async function putWorkspace(record:WorkspaceRecord){validateSnapshot(record.snapshot);await operation('readwrite',s=>s.put(record));window.dispatchEvent(new Event('s2ui-workspaces-change'));}
export async function acknowledgeCloudVersion(id:string,version:number){const connection=await db();await new Promise<void>((resolve,reject)=>{const tx=connection.transaction('projects','readwrite');const store=tx.objectStore('projects');const read=store.get(id);read.onsuccess=()=>{if(read.result)store.put({...read.result,cloudVersion:version});};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});window.dispatchEvent(new Event('s2ui-workspaces-change'));}
let queue:Promise<unknown>=Promise.resolve();
export function saveCurrentWorkspace(){const task=async()=>{let id=load<string>(ACTIVE_WORKSPACE,'');if(!id){id=crypto.randomUUID();save(ACTIVE_WORKSPACE,id);}const previous=await getWorkspace(id);const record:WorkspaceRecord={id,name:previous?.name||'Untitled project',updatedAt:Date.now(),snapshot:snapshotWorkspace(),cloudVersion:previous?.cloudVersion||0};await putWorkspace(record);return record;};const next=queue.then(task,task);queue=next.catch(()=>{});return next;}
export function friendlyStorageError(e: unknown): string {
 const msg = e instanceof Error ? e.message : String(e ?? '');
 if (/database connection is closing|indexeddb|idb|database/i.test(msg)) return 'The browser database is busy or was closed by another tab. Try again in a moment.';
 return msg || 'Local storage failed.';
}
export async function newWorkspace(name:string){const record:WorkspaceRecord={id:crypto.randomUUID(),name:name.trim().slice(0,80)||'Untitled project',updatedAt:Date.now(),cloudVersion:0,snapshot:{version:1,entries:{}}};await putWorkspace(record);return record;}
export async function openWorkspace(record:WorkspaceRecord,saveCurrent=true){if(saveCurrent&&load(ACTIVE_WORKSPACE,'')===record.id){await saveCurrentWorkspace();return;}window.dispatchEvent(new Event('s2ui-workspace-switch'));if(saveCurrent)await saveCurrentWorkspace();restoreSnapshot(record.snapshot);save(ACTIVE_WORKSPACE,record.id);location.reload();}
