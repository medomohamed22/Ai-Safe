import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('node_modules/@mujoco/mujoco');
const out = path.resolve('public/vendor');
fs.mkdirSync(out,{recursive:true});
let files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name);if(ent.isDirectory())walk(full);else if(ent.name.endsWith('.wasm') && !full.includes(`${path.sep}mt${path.sep}`))files.push(full)}}
walk(root);
if(!files.length)throw Error('Missing MuJoCo WASM: npm install must complete.');
for(const file of files){fs.copyFileSync(file,path.join(out,path.basename(file)));console.log('Prepared /vendor/'+path.basename(file));}
