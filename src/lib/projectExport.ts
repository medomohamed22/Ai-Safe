import { materializeAssets } from './designAssets';
import { materializeLibrary } from './componentLibrary';
import JSZip from 'jszip';
import { backendBootstrap, DEFAULT_BACKEND, type BackendConfig } from './backend';
import { screenFiles, type ScreenProject } from './screens';
import { DEFAULT_BRAND } from './brand';
import { designSystemMarkdown } from './designSystem';
import { designTokens } from './brandImport';
import { KEYS, load } from './storage';

function detectExtraDependencies(sources: string[]): Record<string, string> {
  const extra: Record<string, string> = {};
  const builtin = new Set(['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'lucide-react', 'recharts']);
  const importRegex = /(?:from\s+|import\s*\(\s*|import\s+)(['"])([^'"]+)\1/g;
  for (const src of sources) {
    for (const match of src.matchAll(importRegex)) {
      const spec = match[2];
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || /^https?:/.test(spec)) continue;
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (pkg && !builtin.has(pkg) && !builtin.has(spec) && !pkg.endsWith('.css')) {
        extra[pkg] = 'latest';
      }
    }
  }
  return extra;
}

// Backend handoff document: everything a backend developer needs to pick
// up this export and wire a real API behind the generated frontend.
export function backendHandoff(backend: BackendConfig, project?: ScreenProject): string {
  const lines: string[] = [];
  lines.push('# Backend handoff — Sketch2UI export');
  lines.push('');
  lines.push('This project was generated from hand-drawn sketches by Sketch2UI. The frontend is backend-ready: it was built against an explicit data contract so a real API can be connected without rewriting the UI.');
  lines.push('');
  lines.push('## How the frontend talks to data');
  lines.push('');
  lines.push('- `src/backend.js` installs `globalThis.__S2UI_API__` from `API_CONTRACT.json`. It exposes `request(operationId, { params, query, body, signal })` and already applies the configured response data path and field mapping, so UI code receives normalized data.');
  lines.push('- Mode `demo` answers from in-memory demo data — no network, no database. Mode `http` calls the configured `baseUrl`. Demo data is sample data, not a production database.');
  lines.push('- Each generated screen also keeps its own service section near the top of its file: configuration, seed data, and async service functions with the same signatures for demo and HTTP adapters. UI event handlers call that service layer — endpoint strings do not live inside components.');
  lines.push('- No API secrets, database credentials or server-side authorization are included in this export, by design.');
  lines.push('');
  if (backend.endpoints.length) {
    lines.push('## Configured endpoints (from API_CONTRACT.json)');
    lines.push('');
    lines.push('| Operation | Method | Path | Response data path | Response fields (API name → UI name) |');
    lines.push('|---|---|---|---|---|');
    for (const e of backend.endpoints) {
      const fields = Object.entries(e.fields || {}).map(([api, ui]) => `${api} → ${ui}`).join(', ') || '—';
      lines.push(`| ${e.id} | ${e.method} | ${e.path} | ${e.dataPath || '(root)'} | ${fields} |`);
    }
    lines.push('');
    lines.push('Request/response schemas and parameters, when the source API provided them, are preserved per operation in `API_CONTRACT.json`.');
    lines.push('');
  } else {
    lines.push('## Endpoints');
    lines.push('');
    lines.push('No API was configured when this project was exported, so there is no endpoint table yet. Each screen file documents its proposed contract in comments above its service section: assumed paths and methods, request fields, and response shapes. A backend developer can either implement those proposed contracts, or open the project in Sketch2UI, use the Backend panel to import the real OpenAPI spec, and re-export — the configured endpoints then appear here and in `API_CONTRACT.json`.');
    lines.push('');
  }
  lines.push('## Screens and navigation');
  lines.push('');
  if (project && project.screens.length) {
    for (const s of project.screens) lines.push(`- ${s.name} (\`${s.id}\`)`);
    lines.push('');
    lines.push('Navigation links between screens are listed in `SCREENS.json`. Multi-screen sources live in `src/screens/`; the active app entry is `src/App.jsx`.');
    lines.push('');
  } else {
    lines.push('Single-screen app: the source is `src/App.jsx`.');
    lines.push('');
  }
  lines.push('## Connecting a real backend — checklist');
  lines.push('');
  lines.push('1. Implement the endpoints above (or the proposed contract in each screen) with stable record IDs; list endpoints should accept the pagination/filter parameters the UI sends.');
  lines.push('2. Allow this frontend origin in CORS, and decide authentication on the server — the frontend only carries the session/token your API issues.');
  lines.push('3. Point the app at the API: set `baseUrl` and switch `mode` to `http` in `API_CONTRACT.json` (consumed by `src/backend.js`); screens with their own service section take the same base URL in their configuration block.');
  lines.push('4. Run `npm install && npm run dev` and exercise every screen: loading, empty, error and success states are already wired to the service results.');
  lines.push('');
  return lines.join('\n');
}

// Handoff document: how the project was built — the pipeline, the screens
// and versions, and the build conversation's decisions — so a developer (or
// another coding agent) can continue from the export, not just from code.
export function handoffDocument(project?: ScreenProject): string {
  const lines: string[] = [];
  lines.push('# Handoff — how this project was built');
  lines.push('');
  lines.push('Sketch2UI builds through a visible pipeline: the sketch is segmented into elements (SAM 3.1 on the Meta Model API, with an honest vision fallback), the approved plan and the saved design system guide generation, real images are generated for image slots, and the result passes local source checks before it is saved as a new version.');
  lines.push('');
  lines.push('## Screens');
  lines.push('');
  if (project && project.screens.length) {
    for (const s of project.screens) lines.push(`- ${s.name} (\`${s.id}\`) — ${s.versions.length} version${s.versions.length === 1 ? '' : 's'}${s.versions.length ? '' : ' (not generated yet)'}`);
    lines.push('');
    if (project.links.length) {
      lines.push('## Navigation');
      lines.push('');
      for (const l of project.links) {
        const from = project.screens.find((x) => x.id === l.from)?.name || l.from;
        const to = project.screens.find((x) => x.id === l.to)?.name || l.to;
        lines.push(`- ${from} → ${to} ("${l.label}")`);
      }
      lines.push('');
    }
    lines.push('## Build conversation (decisions)');
    lines.push('');
    let any = false;
    for (const s of project.screens) {
      const chat = s.chat ?? [];
      const asks = chat.filter((m) => m.role === 'user');
      const built = chat.filter((m) => m.role === 'ai' && m.kind === 'built').length;
      if (!asks.length && !built) continue;
      any = true;
      lines.push(`### ${s.name}`);
      lines.push('');
      for (const m of asks) lines.push(`- ${m.kind === 'fix' ? 'Fix the runtime error' : m.kind === 'sketch' ? 'Generate from sketch' : m.text ?? ''}`);
      if (built) lines.push(`- → ${built} version${built === 1 ? '' : 's'} built from these requests`);
      lines.push('');
    }
    if (!any) { lines.push('No build conversation was recorded for this project.'); lines.push(''); }
  } else {
    lines.push('Single-screen app: the source is `src/App.jsx`.');
    lines.push('');
  }
  lines.push('## Continue from here');
  lines.push('');
  lines.push('1. Read BACKEND.md for the data contract, and DESIGN.md (when present) for the design tokens.');
  lines.push('2. Run `npm install && npm run dev` and exercise every screen.');
  lines.push('3. To keep designing, reopen the project in Sketch2UI — every screen keeps its version history and build conversation.');
  lines.push('');
  return lines.join('\n');
}

export function projectFiles(code: string, backend: BackendConfig = DEFAULT_BACKEND, project?: ScreenProject): Record<string, string> {
  const extraScreens = project && project.screens.length > 1 ? screenFiles(project) : {};
  const jsxSources = [code, ...Object.values(extraScreens)].map(s => materializeAssets(materializeLibrary(s)));
  const extraDeps = detectExtraDependencies(jsxSources);
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'sketch2ui-export', private: true, version: '1.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '18.3.1', 'react-dom': '18.3.1', 'lucide-react': '0.468.0', recharts: '2.15.0', ...extraDeps },
      devDependencies: { vite: '6.4.4', '@vitejs/plugin-react': '4.7.0', tailwindcss: '3.4.17', postcss: '8.5.6', autoprefixer: '10.4.21' },
    }, null, 2),
    'index.html': '<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Sketch2UI Export</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    'src/App.jsx': code,
    ...extraScreens,
    'src/backend.js': backendBootstrap(backend),
    'API_CONTRACT.json': JSON.stringify(backend, null, 2),
    'BACKEND.md': backendHandoff(backend, project),
    'src/main.jsx': "import './backend';\nimport React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport App from './App';\nimport './index.css';\ncreateRoot(document.getElementById('root')).render(<App/>);\n",
    'src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\nhtml,body,#root{margin:0;min-height:100%;}\n',
    'vite.config.js': "import {defineConfig} from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({plugins:[react()]});\n",
    'tailwind.config.js': "export default {content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{}},plugins:[]};\n",
    'postcss.config.js': 'export default {plugins:{tailwindcss:{},autoprefixer:{}}};\n',
    '.gitignore': 'node_modules/\ndist/\n.env\n.env.*\n!.env.example\n.vercel/\n',
    'vercel.json': JSON.stringify({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist', rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }] }, null, 2),
    'README.md': '# Sketch2UI exported project\n\nRun `npm install`, then `npm run dev`. Build with `npm run build`. Commit the generated package-lock.json after installation.\n\nUpload these contents to GitHub; import in Vercel as Vite with build `npm run build`, output `dist`.\n\n## Backend handoff\n\nApp.jsx preserves the generated source and its service adapters. Start with BACKEND.md — it lists the configured endpoints (or the proposed contract), the screens, and the connection checklist. DESIGN.md (included when a brand identity was saved) carries the design system, and HANDOFF.md summarizes how the project was built: screens, versions, and the decisions in the build conversation. Review the API base URL and backend authentication/CORS before real API use. Demo data is not a production database. No backend or API secrets are included in this export.\n\nReview generated dependencies and external image URLs before production use.\n',
  };
  const brand = load(KEYS.brand, DEFAULT_BRAND);
  if (brand.enabled) { files['DESIGN.md'] = designSystemMarkdown(brand); files['design-tokens.json'] = JSON.stringify(designTokens(brand), null, 2); }
  files['HANDOFF.md'] = handoffDocument(project);
  for (const name of Object.keys(files)) if (name.endsWith('.jsx')) files[name] = materializeAssets(materializeLibrary(files[name]));
  return files;
}

export async function projectZip(code: string, backend: BackendConfig = DEFAULT_BACKEND, project?: ScreenProject) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(projectFiles(code, backend, project))) zip.file(path, content);
  try {
    const { listBrandAssets } = await import('./brandAssets');
    for (const a of await listBrandAssets()) {
      const safe = a.name.replace(/[^\p{L}\p{N}._-]+/gu, '_');
      if (a.kind === 'doc' && a.text) zip.file(`design-assets/${safe}`, a.text);
      else if (a.dataUrl && a.dataUrl.includes(',')) zip.file(`design-assets/${safe}`, a.dataUrl.split(',')[1], { base64: true });
    }
  } catch { /* brand assets are an optional part of the export */ }
  return zip.generateAsync({ type: 'blob' });
}
