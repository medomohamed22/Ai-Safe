import {serviceRequest} from './services';
import JSZip from 'jszip';
import { githubRequest } from './github';
export interface ImportedProject { files: Record<string,string>; entry: string; name: string }
export const IMPORT_KEY = 's2ui.imported.v1';
const allowed = (name: string) => !name.split('/').some(p => ['node_modules','dist','.git','.vercel'].includes(p) || p.startsWith('.env')) && /\.(jsx?|tsx?|json|css|svg|png|jpe?g|webp|md)$/.test(name);
export function validateFiles(files: Record<string,string>) {
 if (!files || Object.keys(files).length > 80 || JSON.stringify(files).length > 2200000) throw new Error('Maximum 80 files / 2 MB uncompressed.');
 for (const [name,content] of Object.entries(files)) if (!allowed(name) || name.startsWith('/') || name.includes('\\') || name.split('/').some(p => !p || p === '.' || p === '..') || typeof content !== 'string' || content.length > 300000) throw new Error(`Unsupported project path or size: ${name}`);
}
export async function importZip(file: File): Promise<ImportedProject> {
 if (file.size > 10e6) throw new Error('Maximum ZIP size: 10 MB.');
 const zip=await JSZip.loadAsync(await file.arrayBuffer()); const files:Record<string,string>={};
 const entries=Object.values(zip.files).filter(e=>!e.dir); const common=entries.some(e=>e.name==='package.json')?'':entries.filter(e=>allowed(e.name)&&e.name.endsWith('/package.json')).sort((a,b)=>a.name.length-b.name.length)[0]?.name.replace(/package.json$/,'') || '';
 for(const e of entries){if(((e as any).unsafeOriginalName||e.name).split('/').includes('..'))throw new Error('Unsafe ZIP path.');const name=common&&e.name.startsWith(common)?e.name.slice(common.length):e.name;if(!allowed(name))continue;if((e as any)._data?.uncompressedSize>300000)throw new Error(`File too large: ${name}`);const asset=/\.(png|jpe?g|webp)$/.test(name);files[name]=asset?`data:image/${name.endsWith('png')?'png':name.endsWith('webp')?'webp':'jpeg'};base64,${await e.async('base64')}`:await e.async('string');validateFiles(files);}
 const entry=Object.keys(files).find(p=>/(^|\/)App\.[jt]sx?$/.test(p)) || Object.keys(files).find(p=>/\.[jt]sx?$/.test(p)) || '';
 if(!entry)throw new Error('No React component source found.');return {files,entry,name:file.name.replace(/\.zip$/i,'')};
}
export async function importRepository(repo:string,token:string):Promise<ImportedProject>{
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw new Error('Use owner/repository.');
 const metadata=await githubRequest(token,`/repos/${repo}`);const tree=await githubRequest(token,`/repos/${repo}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`);if(tree.truncated)throw new Error('Repository tree is truncated.');
 const entries=tree.tree.filter((e:any)=>e.type==='blob'&&allowed(e.path));if(entries.length>80)throw new Error('Repository exceeds 80 supported files. Import a smaller ZIP.');const files:Record<string,string>={};
 for(const item of entries){if(item.size>200000)throw new Error(`File too large: ${item.path}`);const blob=await githubRequest(token,`/repos/${repo}/git/blobs/${item.sha}`);if(blob.encoding!=='base64')throw new Error('Unsupported GitHub blob encoding');const binary=atob(blob.content.replace(/\s/g,''));if(/\.(png|jpe?g|webp)$/.test(item.path))files[item.path]=`data:image/${item.path.endsWith('png')?'png':item.path.endsWith('webp')?'webp':'jpeg'};base64,${blob.content.replace(/\s/g,'')}`;else files[item.path]=new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));validateFiles(files);}
 const entry=Object.keys(files).find(p=>/(^|\/)App\.[jt]sx?$/.test(p));if(!entry)throw new Error('Choose a ZIP for repositories without App.jsx/tsx.');return{files,entry,name:repo};
}
export async function buildImported(project:ImportedProject){validateFiles(project.files);const response=await serviceRequest('/api/project-bundle',project);const data=await response.json();if(!response.ok||typeof data.code!=='string')throw new Error(data.error||'Import bundler unavailable');return data.code as string;}
export async function exportImported(project:ImportedProject){validateFiles(project.files);const zip=new JSZip();for(const [name,content]of Object.entries(project.files)){if(content.startsWith('data:image/'))zip.file(name,content.split(',')[1],{base64:true});else zip.file(name,content);}return zip.generateAsync({type:'blob'});}
