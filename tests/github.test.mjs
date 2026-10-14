import assert from 'node:assert/strict';
import {createGitHubBranch, reviewGitHub} from '../src/lib/github.ts';
const calls=[];
const fetcher=async(url,init)=>{calls.push({url:String(url),method:init.method});return new Response(JSON.stringify({commit:{sha:'changed-head'}}));};
await assert.rejects(()=>createGitHubBranch({repo:'owner/repo',baseBranch:'main',baseSha:'old-head',treeSha:'tree',changes:[{path:'src/App.jsx',content:'new'}]},'test','sketch2ui-new',fetcher),/base branch changed/);
assert.ok(calls.every(c=>c.method==='GET'));
await assert.rejects(()=>reviewGitHub('bad/repo/extra','test',{},'',fetcher),/owner\/repository/);
console.log('PASS: stale GitHub review rejects publication before writes; invalid repository rejected. Mocked HTTP only.');
