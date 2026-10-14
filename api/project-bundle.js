import { build } from 'esbuild';
import path from 'node:path';
const packages = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'lucide-react', 'recharts']);
export async function bundleFiles(files, entry) {
 if (!files || Object.keys(files).length > 80 || JSON.stringify(files).length > 2200000) throw new Error('Import at most 80 files / 2 MB.');
 for (const [name, content] of Object.entries(files)) if (typeof content !== 'string' || name.startsWith('/') || name.includes('\\') || name.split('/').some(p => !p || p === '..' || p === '.' || p === 'node_modules' || p === '.git') || name.split('/').some(p => p.startsWith('.env')) || content.length > 300000) throw new Error('Invalid or oversized project file.');
 if (!files[entry] || !/\.[jt]sx?$/.test(entry)) throw new Error('Select a JS/JSX/TS/TSX component entry file.');
 const resolve = name => [name, ...['.jsx','.tsx','.js','.ts','.json','/index.jsx','/index.tsx','/index.js'].map(ext => name + ext)].find(p => Object.hasOwn(files, p));
 const result = await build({ stdin: { contents: `export {default} from ${JSON.stringify('./' + entry)};`, sourcefile: '__entry__.js', resolveDir: '/' }, bundle: true, format: 'esm', platform: 'browser', write: false, jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'imported-project-files', setup(b) {
  b.onResolve({filter:/.*/}, args => {
   if (packages.has(args.path)) return { path: args.path, external: true };
   if (!args.path.startsWith('.') && !args.path.startsWith('/')) throw new Error(`Unsupported package: ${args.path}. Supported: ${[...packages].join(', ')}`);
   const name = path.posix.normalize(path.posix.join(path.posix.dirname(args.importer || '__entry__.js'), args.path));
   if (name.startsWith('../') || name.startsWith('/')) throw new Error('Import leaves project root.');
   const found = resolve(name); if (!found) throw new Error(`Missing project module: ${name}`);
   return { path: found, namespace: 'imported' };
  });
  b.onLoad({filter:/.*/,namespace:'imported'}, args => {
   const source = files[args.path]; const ext = args.path.split('.').pop();
   if (ext === 'css') return { contents: `const style=document.createElement('style');style.textContent=${JSON.stringify(source)};document.head.appendChild(style);export default {};`, loader: 'js' };
   if (source.startsWith('data:image/')) return { contents: `export default ${JSON.stringify(source)}`, loader: 'js' };
   if (ext === 'svg') return { contents: `export default ${JSON.stringify('data:image/svg+xml,' + encodeURIComponent(source))}`, loader: 'js' };
   if (!['js','jsx','ts','tsx','json'].includes(ext)) throw new Error(`Unsupported file: ${args.path}`);
   return { contents: source, loader: ext };
  });
 }}] });
 const output = result.outputFiles[0].text;
 // The preview expects an explicit default export, rather than a named alias.
 const match = output.match(/export\s*\{\s*([\w$]+)\s+as\s+default\s*\};?\s*$/);
 if (!match) throw new Error('Project entry must expose exactly one default component.');
 return output.slice(0, match.index) + `export default ${match[1]};`;
}
export default async function handler(req,res) {
 res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
 if (req.method !== 'POST') {res.statusCode=405;res.end(JSON.stringify({error:'POST required'}));return;}
 if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {res.statusCode=403;res.end(JSON.stringify({error:'Same-origin requests only'}));return;}
 try {let body=req.body;if(!body){let data='';for await(const c of req){data+=c;if(data.length>2300000)throw new Error('Project too large');}body=JSON.parse(data);}if(typeof body==='string')body=JSON.parse(body);const code=await bundleFiles(body.files,body.entry);res.end(JSON.stringify({code}));}catch(e){res.statusCode=422;res.end(JSON.stringify({error:String(e.message||e).slice(0,700)}));}
}
