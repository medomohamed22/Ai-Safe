import { materializeAssets } from './designAssets';
import { materializeLibrary } from './componentLibrary';
import JSZip from 'jszip';
import { backendBootstrap, DEFAULT_BACKEND, type BackendConfig } from './backend';
import { screenFiles, type ScreenProject } from './screens';

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
    'src/main.jsx': "import './backend';\nimport React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport App from './App';\nimport './index.css';\ncreateRoot(document.getElementById('root')).render(<App/>);\n",
    'src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\nhtml,body,#root{margin:0;min-height:100%;}\n',
    'vite.config.js': "import {defineConfig} from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({plugins:[react()]});\n",
    'tailwind.config.js': "export default {content:['./index.html','./src/**/*.{js,jsx}'],theme:{extend:{}},plugins:[]};\n",
    'postcss.config.js': 'export default {plugins:{tailwindcss:{},autoprefixer:{}}};\n',
    '.gitignore': 'node_modules/\ndist/\n.env\n.env.*\n!.env.example\n.vercel/\n',
    'vercel.json': JSON.stringify({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist', rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }] }, null, 2),
    'README.md': '# Sketch2UI exported project\n\nRun `npm install`, then `npm run dev`. Build with `npm run build`. Commit the generated package-lock.json after installation.\n\nUpload these contents to GitHub; import in Vercel as Vite with build `npm run build`, output `dist`.\n\n## Backend handoff\n\nApp.jsx preserves the generated source and its service adapters. Review its proposed contract, API base URL and backend authentication/CORS before real API use. Demo data is not a production database. No backend or API secrets are included in this export.\n\nReview generated dependencies and external image URLs before production use.\n',
  };
  for (const name of Object.keys(files)) if (name.endsWith('.jsx')) files[name] = materializeAssets(materializeLibrary(files[name]));
  return files;
}

export async function projectZip(code: string, backend: BackendConfig = DEFAULT_BACKEND, project?: ScreenProject) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(projectFiles(code, backend, project))) zip.file(path, content);
  return zip.generateAsync({ type: 'blob' });
}
