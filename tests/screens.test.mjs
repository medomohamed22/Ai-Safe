import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { projectFiles } from '../src/lib/projectExport.ts';
const project={activeId:'a',screens:[{id:'a',name:'Home',versions:['export default function App(){return <h1>Home screen</h1>}'],vIndex:0,scene:null},{id:'b',name:'Settings',versions:['export default function App(){return <h1>Settings screen</h1>}'],vIndex:0,scene:null}],links:[{from:'a',to:'b',label:'Settings'},{from:'b',to:'a',label:'Home'}]};
const files=projectFiles('',undefined,project);
assert.match(files['src/screens/Screen0.jsx'],/Home screen/);assert.match(files['src/screens/Screen1.jsx'],/Settings screen/);assert.match(files['src/App.jsx'],/setActive\(link.to\)/);
for(const [name,content]of Object.entries(files)){const target=path.resolve('.qa/export-project',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content);}
console.log('PASS: multi-screen source files and navigation shell exported; extracted fixture updated for build.');
