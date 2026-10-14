import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Same handler that Vercel runs as an Edge Function, reused locally in `npm run dev`.
import proxyHandler from './api/proxy.js';

function devApiProxy(): Plugin {
  return {
    name: 'dev-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') {
              try { headers.set(k, v); } catch { /* ignore forbidden headers */ }
            }
          }
          const method = req.method || 'GET';
          const request = new Request('http://localhost' + ((req as any).originalUrl || req.url), {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const r: Response = await proxyHandler(request);
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          if (r.body) {
            const reader = r.body.getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          }
          res.end();
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { message: String(e?.message || e) } }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiProxy()],
  define: {
    // Required by @excalidraw/excalidraw when bundled with Vite
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
});
