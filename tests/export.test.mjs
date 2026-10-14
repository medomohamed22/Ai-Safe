import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { projectFiles, projectZip } from '../src/lib/projectExport.ts';
const fixture = "import {useState} from 'react';export default function App(){const [n,setN]=useState(0);return <button className='bg-indigo-600 p-4 text-white' onClick={()=>setN(n+1)}>Count {n}</button>}";
const blob = await projectZip(fixture);
const zip = await JSZip.loadAsync(await blob.arrayBuffer());
const files = projectFiles(fixture);
for (const [name, content] of Object.entries(files)) {
 assert.equal(await zip.file(name).async('string'), content);
 const target = path.resolve('.qa/export-project', name);
 await fs.mkdir(path.dirname(target), {recursive:true}); await fs.writeFile(target,content);
}
assert.ok(!Object.keys(zip.files).some(name=>name.startsWith('node_modules') || name.startsWith('dist')));
console.log('PASS: ZIP contents match source and extracted project is ready for build test.');
