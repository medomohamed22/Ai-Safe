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
    var selectedEl = null;
    var drag = null;
    var suppressClick = false;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483646;';
    var handles = {};
    [['e', 'ew-resize'], ['s', 'ns-resize'], ['se', 'nwse-resize']].forEach(function (def) {
      var h = document.createElement('div');
      h.setAttribute('data-s2ui-handle', def[0]);
      h.style.cssText = 'position:fixed;width:15px;height:15px;margin:-8px 0 0 -8px;background:#fff;border:2px solid #6366f1;border-radius:3px;box-sizing:border-box;pointer-events:auto;display:none;cursor:' + def[1] + ';';
      overlay.appendChild(h);
      handles[def[0]] = h;
    });
    var dropLine = document.createElement('div');
    dropLine.style.cssText = 'position:fixed;background:#6366f1;border-radius:2px;display:none;pointer-events:none;';
    overlay.appendChild(dropLine);
    document.body.appendChild(overlay);
    function placeHandles() {
      var show = editing && selectedEl && selectedEl.isConnected;
      ['e', 's', 'se'].forEach(function (k) { handles[k].style.display = show ? 'block' : 'none'; });
      if (!show) return;
      var r = selectedEl.getBoundingClientRect();
      handles.e.style.left = r.right + 'px'; handles.e.style.top = (r.top + r.height / 2) + 'px';
      handles.s.style.left = (r.left + r.width / 2) + 'px'; handles.s.style.top = r.bottom + 'px';
      handles.se.style.left = r.right + 'px'; handles.se.style.top = r.bottom + 'px';
    }
    function selectEl(el) {
      document.querySelectorAll('[data-s2ui-selected]').forEach(function (item) { item.removeAttribute('data-s2ui-selected'); });
      selectedEl = el;
      if (el) el.setAttribute('data-s2ui-selected', '');
      placeHandles();
    }
    function postSelected(el) {
      parent.postMessage({ source: 's2ui-preview', type: 'element-selected', token: token, id: Number(el.getAttribute('data-s2ui-id')) }, '*');
    }
    window.addEventListener('message', function (e) {
      if (e.source !== parent || !e.data || e.data.token !== token || e.data.type !== 'edit-mode') return;
      editing = !!e.data.enabled;
      if (!editing) { if (drag) endDrag(false); selectEl(null); }
      else placeHandles();
    });
    window.addEventListener('resize', placeHandles);
    window.addEventListener('scroll', placeHandles, true);
    function startResize(kind, e) {
      var r = selectedEl.getBoundingClientRect();
      drag = { mode: 'resize', kind: kind, x: e.clientX, y: e.clientY, w: r.width, h: r.height, ow: selectedEl.style.width, oh: selectedEl.style.height };
    }
    function startMove(el, e) {
      var parentEl = el.parentElement;
      var sibs = parentEl ? Array.prototype.filter.call(parentEl.children, function (c) { return c.hasAttribute && c.hasAttribute('data-s2ui-id'); }) : [];
      var rects = {};
      sibs.forEach(function (s) { rects[s.getAttribute('data-s2ui-id')] = s.getBoundingClientRect(); });
      var axis = 'y';
      if (sibs.length > 1) {
        var tops = sibs.map(function (s) { return rects[s.getAttribute('data-s2ui-id')].top; });
        if (Math.max.apply(null, tops) - Math.min.apply(null, tops) < 8) axis = 'x';
      }
      drag = { mode: 'move', el: el, x: e.clientX, y: e.clientY, active: false, sibs: sibs, rects: rects, axis: axis, target: null, ot: el.style.transform, oo: el.style.opacity, op: el.style.position, oz: el.style.zIndex };
    }
    function dragMove(e) {
      if (!drag) return;
      if (drag.mode === 'resize') {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (drag.kind === 'e' || drag.kind === 'se') { drag.nw = Math.max(24, Math.round(drag.w + dx)); selectedEl.style.width = drag.nw + 'px'; }
        if (drag.kind === 's' || drag.kind === 'se') { drag.nh = Math.max(24, Math.round(drag.h + dy)); selectedEl.style.height = drag.nh + 'px'; }
        placeHandles();
        return;
      }
      var mx = e.clientX - drag.x, my = e.clientY - drag.y;
      if (!drag.active && Math.abs(mx) + Math.abs(my) > 6) { drag.active = true; drag.el.style.position = 'relative'; drag.el.style.opacity = '.75'; drag.el.style.zIndex = '40'; }
      if (!drag.active) return;
      drag.el.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      var p = drag.axis === 'y' ? e.clientY : e.clientX;
      var best = null, bestDist = Infinity;
      drag.sibs.forEach(function (s) {
        if (s === drag.el) return;
        var r = drag.rects[s.getAttribute('data-s2ui-id')];
        var c = drag.axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2;
        var d = Math.abs(p - c);
        if (d < bestDist) { bestDist = d; best = { el: s, rect: r, before: p < c }; }
      });
      drag.target = best;
      if (best && drag.el.parentElement) {
        var pr = drag.el.parentElement.getBoundingClientRect();
        dropLine.style.display = 'block';
        if (drag.axis === 'y') { dropLine.style.left = pr.left + 'px'; dropLine.style.width = pr.width + 'px'; dropLine.style.height = '3px'; dropLine.style.top = ((best.before ? best.rect.top : best.rect.bottom) - 2) + 'px'; }
        else { dropLine.style.top = pr.top + 'px'; dropLine.style.height = pr.height + 'px'; dropLine.style.width = '3px'; dropLine.style.left = ((best.before ? best.rect.left : best.rect.right) - 2) + 'px'; }
      } else dropLine.style.display = 'none';
    }
    function endDrag(commit) {
      if (!drag) return;
      var d = drag; drag = null;
      dropLine.style.display = 'none';
      if (d.mode === 'resize') {
        if (selectedEl) { selectedEl.style.width = d.ow; selectedEl.style.height = d.oh; }
        if (commit && selectedEl && (d.nw !== undefined || d.nh !== undefined)) {
          var msg = { source: 's2ui-preview', type: 'element-resized', token: token, id: Number(selectedEl.getAttribute('data-s2ui-id')) };
          if (d.nw !== undefined) msg.width = d.nw;
          if (d.nh !== undefined) msg.height = d.nh;
          parent.postMessage(msg, '*');
          suppressClick = true;
        }
      } else {
        d.el.style.transform = d.ot; d.el.style.opacity = d.oo; d.el.style.position = d.op; d.el.style.zIndex = d.oz;
        if (commit && d.active && d.target) {
          var mid = Number(d.el.getAttribute('data-s2ui-id'));
          var tid = Number(d.target.el.getAttribute('data-s2ui-id'));
          if (tid !== mid) {
            parent.postMessage({ source: 's2ui-preview', type: 'element-reordered', token: token, id: mid, targetId: tid, before: d.target.before }, '*');
            suppressClick = true;
          }
        }
      }
      placeHandles();
    }
    window.addEventListener('pointermove', dragMove, true);
    window.addEventListener('pointerup', function () { endDrag(true); }, true);
    window.addEventListener('pointercancel', function () { endDrag(false); }, true);
    function intercept(e) {
      if (!editing) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var handle = e.target.closest && e.target.closest('[data-s2ui-handle]');
      if (e.type === 'pointerdown' && handle && selectedEl) { startResize(handle.getAttribute('data-s2ui-handle'), e); return; }
      var el = e.target.closest && e.target.closest('[data-s2ui-id]');
      if (e.type === 'pointerdown') {
        if (el) {
          if (el === selectedEl) {
            var r = el.getBoundingClientRect();
            var nearR = Math.abs(e.clientX - r.right) <= 12 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6;
            var nearB = Math.abs(e.clientY - r.bottom) <= 12 && e.clientX >= r.left - 6 && e.clientX <= r.right + 6;
            if (nearR && nearB) { startResize('se', e); return; }
            if (nearR) { startResize('e', e); return; }
            if (nearB) { startResize('s', e); return; }
          }
          selectEl(el); postSelected(el); startMove(el, e);
        }
        return;
      }
      if (e.type !== 'click') return;
      if (suppressClick) { suppressClick = false; return; }
      if (!el) return;
      selectEl(el);
      postSelected(el);
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
