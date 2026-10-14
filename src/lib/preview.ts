// Builds a fully isolated HTML document that compiles & runs AI-generated React code
// inside a sandboxed iframe (no allow-same-origin → cannot read the app's localStorage/API keys).

import { materializeAssets } from './designAssets';
import { materializeLibrary } from './componentLibrary';
import { instrumentPreview } from './visualEdit';
import { backendBootstrap, DEFAULT_BACKEND, type BackendConfig } from './backend';
import { auditDocument } from './quality';
import { installTestRunner } from './interactionTests';

const IMPORT_MAP: Record<string, string> = {
  react: 'https://esm.sh/react@18.3.1',
  'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime',
  'react-dom': 'https://esm.sh/react-dom@18.3.1?external=react',
  'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?external=react',
  'lucide-react': 'https://esm.sh/lucide-react@0.468.0?external=react',
  recharts: 'https://esm.sh/recharts@2.15.0?external=react,react-dom',
};

const safeJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function buildPreviewHtml(code: string, editor?: { token: string; tests?: boolean; preserveInstrumentation?: boolean }, backend: BackendConfig = DEFAULT_BACKEND): string {
  let source = code;
  if (editor && !editor.preserveInstrumentation) {
    try { source = instrumentPreview(code); } catch { /* Existing runtime error reporting handles invalid JSX. */ }
  }
  try { source = materializeAssets(materializeLibrary(source)); } catch (e) { source = `export default function App(){ throw new Error(${JSON.stringify((e as Error).message)}) }`; }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
<script type="importmap">${safeJson({ imports: IMPORT_MAP })}</script>
<style>
  html, body { margin: 0; min-height: 100%; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  #__s2ui_err { display:none; position:fixed; inset:auto 12px 12px 12px; background:#1f0f12; color:#fecaca; border:1px solid #7f1d1d; border-radius:10px; padding:12px 14px; font:12px/1.5 ui-monospace, monospace; white-space:pre-wrap; max-height:40vh; overflow:auto; z-index:2147483647; }
</style>
</head>
<body>
<div id="root"></div>
<div id="__s2ui_err"></div>
<script>
  window.__report = function (m) {
    var msg = String(m && m.message ? m.message : m);
    var el = document.getElementById('__s2ui_err');
    if (el) { el.style.display = 'block'; el.textContent = msg; }
    parent.postMessage({ source: 's2ui-preview', type: 'error', message: msg }, '*');
  };
  window.addEventListener('error', function (e) { window.__report(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { window.__report(e.reason); });
  window.__SRC__ = ${safeJson(source)};
  window.__KNOWN__ = ${safeJson(Object.keys(IMPORT_MAP))};
  ${backendBootstrap(backend)}
  ${editor?.tests ? `(${installTestRunner.toString()})(${safeJson(editor.token)}, (${auditDocument.toString()}));` : ''}
</script>
${editor ? `<style>[data-s2ui-selected] { outline: 3px solid #6366f1 !important; outline-offset: 3px; }</style>
<script>
  (function () {
    var token = ${safeJson(editor.token)};
    var editing = false;
    window.addEventListener('message', function (e) {
      if (e.source !== parent || !e.data || e.data.token !== token || e.data.type !== 'edit-mode') return;
      editing = !!e.data.enabled;
      if (!editing) document.querySelectorAll('[data-s2ui-selected]').forEach(function (el) { el.removeAttribute('data-s2ui-selected'); });
    });
    function intercept(e) {
      if (!editing) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type !== 'click') return;
      var el = e.target.closest && e.target.closest('[data-s2ui-id]');
      if (!el) return;
      document.querySelectorAll('[data-s2ui-selected]').forEach(function (item) { item.removeAttribute('data-s2ui-selected'); });
      el.setAttribute('data-s2ui-selected', '');
      parent.postMessage({ source: 's2ui-preview', type: 'element-selected', token: token, id: Number(el.getAttribute('data-s2ui-id')) }, '*');
    }
    ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'submit', 'keydown', 'input', 'change'].forEach(function (name) { window.addEventListener(name, intercept, true); });
  })();
</script>` : ''}
<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err: err }; }
  componentDidCatch(err) { window.__report(err); }
  render() { return this.state.err ? null : this.props.children; }
}

function prepare(src) {
  src = src.replace(/^\\s*import\\s+['"][^'"]+\\.css['"];?\\s*$/gm, '');
  if (!/export\\s+default/.test(src)) {
    var m = src.match(/(?:function|const|let|class)\\s+(App|[A-Z]\\w*)/);
    if (m) src += '\\nexport default ' + m[1] + ';';
  }
  return src;
}

try {
  var out = Babel.transform(prepare(window.__SRC__), {
    filename: 'App.tsx',
    presets: [['typescript', { isTSX: true, allExtensions: true }], ['react', { runtime: 'automatic' }]],
  }).code;
  var known = new Set(window.__KNOWN__);
  // Any package not in the import map is loaded on the fly from esm.sh
  out = out.replace(/(\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\bimport\\s+)(['"])([^'"]+)\\2/g, function (all, pre, q, spec) {
    if (spec[0] === '.' || spec[0] === '/' || /^https?:/.test(spec) || known.has(spec)) return all;
    return pre + q + 'https://esm.sh/' + spec + '?external=react,react-dom' + q;
  });
  var url = URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
  var mod;
  try { mod = await import(url); }
  catch (e) {
    if (/Failed to fetch|blob/i.test(String(e && e.message))) {
      mod = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(out));
    } else { throw e; }
  }
  var App = mod.default;
  if (typeof App !== 'function' && typeof App !== 'object') throw new Error('No default-exported React component found.');
  createRoot(document.getElementById('root')).render(React.createElement(Boundary, null, React.createElement(App)));
  parent.postMessage({ source: 's2ui-preview', type: 'ready' }, '*');
} catch (e) {
  window.__report(e);
}
</script>
</body>
</html>`;
}

/** Standalone HTML export (for "Download HTML"). */
export function buildStandaloneHtml(code: string): string {
  return buildPreviewHtml(code);
}
