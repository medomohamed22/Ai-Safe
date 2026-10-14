import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import quality from './api/quality.js';
import screenshot from './api/screenshot.js';
import bundle from './api/project-bundle.js';
import proxy from './api/proxy.js';
const root=path.resolve('dist');const port=Number(process.env.PORT||5175);const host=process.env.HOST||'127.0.0.1';
const handlers={'/api/quality':quality,'/api/screenshot':screenshot,'/api/project-bundle':bundle};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://'+req.headers.host);const origin=req.headers.origin;
 if(origin&&new URL(origin).host!==req.headers.host){if(origin!==process.env.APP_ORIGIN||!process.env.RUNNER_TOKEN){res.writeHead(403);res.end('Origin not allowed');return;}res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}if(req.headers.authorization!==`Bearer ${process.env.RUNNER_TOKEN}`){res.writeHead(401);res.end(JSON.stringify({error:'Service token required'}));return;}delete req.headers.origin;}
 if(handlers[url.pathname]){if(process.env.RUNNER_TOKEN&&req.headers.authorization!==`Bearer ${process.env.RUNNER_TOKEN}`){res.writeHead(401);res.end(JSON.stringify({error:'Service token required'}));return;}await handlers[url.pathname](req,res);return;}
 if(url.pathname==='/api/proxy'){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>5000000)throw new Error('Proxy request too large');chunks.push(chunk);}const response=await proxy(new Request('http://'+req.headers.host+req.url,{method:req.method,headers:Object.fromEntries(Object.entries(req.headers).filter(([,v])=>typeof v==='string')),body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
 if(url.pathname.startsWith('/api/')){res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'API route not found'}));return;}
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(200,{'Content-Type':'text/html'});res.end(await fs.readFile(path.join(root,'index.html')));}
 }catch(e){if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(e.message||e).slice(0,300)}));}}).listen(port,host,()=>console.log(`Sketch2UI app + services: http://${host}:${port}`));
