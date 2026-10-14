// Compile generated JSX with a fixed, trusted Vite configuration. Never load
// generated config files, install packages, run scripts or execute generated JS.
import { build } from 'vite';
import path from 'node:path';
import { parse } from '@babel/parser';
import { traverseFast } from '@babel/types';
let busy = false;
export async function compileGenerated(code) {
 if (typeof code !== 'string' || !code.trim() || code.length > 200000) throw new Error('Provide at most 200,000 characters of JSX.');
 const ast=parse(code,{sourceType:'module',plugins:['jsx']});
 traverseFast(ast,node=>{if(node.type==='MetaProperty'&&node.meta.name==='import')throw new Error('import.meta build macros and filesystem/environment lookups are not supported by the generated-source checker.');});
 const root = process.cwd();
 const entry = path.join(root, '__s2ui_quality_entry__.jsx').replaceAll('\\', '/');
 const app = path.join(root, '__s2ui_quality_app__.jsx').replaceAll('\\', '/');
 const allowed = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'recharts']);
 const result = await build({ configFile: false, envDir: false, root, logLevel: 'silent',
  esbuild: { jsx: 'automatic' },
  define: { 'import.meta.env': JSON.stringify({ MODE: 'production', PROD: true, DEV: false }) },
  plugins: [{ name: 'generated-quality-input', enforce: 'pre',
   resolveId(id, importer) {
    if (id === entry || id === app) return id;
    if (importer === app && !allowed.has(id)) throw new Error(`Unsupported generated import: ${id.slice(0, 120)}`);
   },
   load(id) { if (id === entry) return `import React from 'react';import {createRoot} from 'react-dom/client';import App from ${JSON.stringify(app)};createRoot(document.getElementById('root')).render(<App/>);`; if (id === app) return code; },
  }],
  build: { write: false, minify: false, rollupOptions: { input: entry }, emptyOutDir: false },
 });
 const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output || []);
 return { passed: true, name: 'Production JavaScript bundle', detail: `Vite bundled ${outputs.length} output(s). Build uses installed supported packages; CSS, deployment and TypeScript types are separate checks.` };
}
export default async function handler(req, res) {
 res.setHeader('Content-Type', 'application/json');
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'POST required' })); return; }
 const origin = req.headers.origin;
 if (origin && new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Same-origin requests only' })); return; }
 if (busy) { res.statusCode = 429; res.end(JSON.stringify({ error: 'Another compile is running. Try again shortly.' })); return; }
 busy = true;
 try {
  let body = req.body;
  if (!body) { let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 250000) throw new Error('Payload too large'); } body = JSON.parse(data); }
  if (typeof body === 'string') body = JSON.parse(body);
  const result = await compileGenerated(body.code); res.end(JSON.stringify(result));
 } catch (e) { res.statusCode = 422; res.end(JSON.stringify({ passed: false, name: 'Production JavaScript bundle', detail: String(e.message || e).replaceAll(process.cwd(), '[workspace]').slice(0, 600) })); }
 finally { busy = false; }
}
