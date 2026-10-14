import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const root=path.resolve('.qa/export-project');
const zip=await JSZip.loadAsync(await fs.readFile('.qa/browser-export.zip'));
for(const [name,file]of Object.entries(zip.files)){
 if(file.dir)continue;
 const target=path.resolve(root,name);if(!target.startsWith(root+path.sep))throw new Error('Unsafe export path.');
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,await file.async('nodebuffer'));
}
console.log('Extracted the actual production-browser ZIP for build verification.');
