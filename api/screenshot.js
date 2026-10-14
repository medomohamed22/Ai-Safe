import { chromium } from 'playwright';
import fs from 'node:fs';
let busy = false;
export default async function handler(req, res) {
 res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'POST required' })); return; }
 if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Same-origin requests only' })); return; }
 if (busy) { res.statusCode = 429; res.end(JSON.stringify({ error: 'A capture is running; try again shortly.' })); return; }
 let browser; busy = true;
 try {
  let body = req.body;
  if (!body) { let data = ''; for await (const c of req) { data += c; if (data.length > 600000) throw new Error('Capture payload too large'); } body = JSON.parse(data); }
  if (typeof body === 'string') body = JSON.parse(body);
  if (typeof body.html !== 'string' || body.html.length > 500000) throw new Error('Invalid capture HTML');
  const width = Math.max(320, Math.min(1440, Number(body.width) || 820));
  const height = Math.max(300, Math.min(1200, Number(body.height) || 900));
  const chrome = process.env.CHROME_PATH || (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  browser = await chromium.launch({ executablePath: chrome, headless: true, chromiumSandbox: true });
  const timeout = setTimeout(() => browser?.close().catch(() => {}), 60000);
  try {
   const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', acceptDownloads: false });
   const blocked = new Set();
   await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['data:', 'blob:', 'about:'].includes(url.protocol) || url.protocol === 'https:' && ['esm.sh', 'cdn.tailwindcss.com', 'unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.continue();
    blocked.add(url.hostname); return route.abort();
   });
   const page = await context.newPage();
   await page.setContent(body.html, { waitUntil: 'domcontentloaded', timeout: 15000 });
   await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0 || document.querySelector('#__s2ui_err')?.textContent, { timeout: 45000 });
   const error = await page.locator('#__s2ui_err').textContent().catch(() => '');
   if (error) throw new Error(error);
   const png = await page.screenshot({ type: 'png', animations: 'disabled' });
   res.end(JSON.stringify({ image: `data:image/png;base64,${png.toString('base64')}`, width, height, blockedHosts: [...blocked] }));
  } finally { clearTimeout(timeout); }
 } catch(e) { res.statusCode = 422; res.end(JSON.stringify({ error: `Capture unavailable: ${String(e.message || e).replaceAll(process.cwd(), '[workspace]').slice(0, 500)}. The capture service needs installed Chrome/Chromium; a normal Vercel deployment alone does not provide it.` })); }
 finally { await browser?.close().catch(() => {}); busy = false; }
}
