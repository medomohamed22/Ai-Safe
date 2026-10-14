import assert from 'node:assert/strict';
import {compileGenerated} from '../api/quality.js';
const result=await compileGenerated('export default function App(){return <h1>Build fixture</h1>}');assert.equal(result.passed,true);
assert.equal((await compileGenerated("import {LineChart,Line} from 'recharts';export default function App(){return <LineChart width={200} height={100} data={[{value:1}]}><Line dataKey='value'/></LineChart>}")).passed,true);
await assert.rejects(()=>compileGenerated('export default function App(){return <div>}'));
await assert.rejects(()=>compileGenerated("import fs from 'node:fs';export default function App(){return null}"),/Unsupported/);
await assert.rejects(()=>compileGenerated("export default function App(){return new URL('../../.env',import /*comment*/ .meta.url)}"),/macros/);
await assert.rejects(()=>compileGenerated("import {NotAnActualIcon123} from 'lucide-react';export default function App(){return <NotAnActualIcon123/>}"),/not exported|No matching export/);
console.log('PASS: actual Vite bundle, invalid JSX and unresolved symbols rejected, Node imports and comment-obfuscated import.meta filesystem macros blocked before build.');
