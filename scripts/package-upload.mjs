import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
const root = fileURLToPath(new URL('../', import.meta.url));
const zip = new JSZip();
const included = [];
async function add(name) {
 const full = path.join(root, name);
 const stat = await fs.stat(full);
 if (stat.isDirectory()) { for (const child of await fs.readdir(full)) await add(`${name}/${child}`); return; }
 if (/\.(png|jpe?g|webp|log)$/i.test(name)) return;
 zip.file(name, await fs.readFile(full)); included.push(name);
}
for (const name of ['src','api','tests','scripts','index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','.gitignore','README.md','TODO.md','VALIDATION.md','UI_DESIGN.md','PRODUCTIVITY.md','server.mjs','supabase']) await add(name);
const output = path.resolve(root, '../sketch2ui-github-ready.zip');
const archive = await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
await fs.writeFile(output,archive);
const verified = await JSZip.loadAsync(await fs.readFile(output));
if (included.some(name=>!verified.file(name)) || Object.keys(verified.files).some(name=>/^(node_modules|dist|\.qa|\.env|\.git\/)/.test(name))) throw new Error('Upload ZIP verification failed.');
console.log(JSON.stringify({output,files:included.length,bytes:archive.length,verified:true}));
