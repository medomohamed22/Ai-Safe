import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Loader2,
  Monitor,
  MonitorPlay,
  Smartphone,
  Square,
  Tablet,
  Wand2,
} from 'lucide-react';
import { buildPreviewHtml } from '../lib/preview';
import { VisualEditor } from './VisualEditor';
import { describeElement } from '../lib/visualEdit';
import { projectFiles, projectZip } from '../lib/projectExport';
import type { BackendConfig } from '../lib/backend';
import { backendBootstrap } from '../lib/backend';
import { TestsPanel } from './TestsPanel';
import { screenNavigation, type ScreenProject } from '../lib/screens';
import { GitHubPanel } from './GitHubPanel';
import { SharePanel } from './SharePanel';

interface Props {
  locks: string[];
  onToggleLock: (snippet: string) => void;
  project: ScreenProject;
  onNavigate: (id: string) => void;
  backend: BackendConfig;
  code: string;
  generating: boolean;
  stream: string;
  modelLabel: string;
  apiError: string | null;
  versionIndex: number;
  versionCount: number;
  hasModel: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStop: () => void;
  onFix: (error: string) => void;
  onDismissError: () => void;
  onOpenSettings: () => void;
  onCodeChange: (code: string) => void;
  onElementRequest: (instruction: string) => void;
}

type Device = 'desktop' | 'tablet' | 'mobile';
const WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };

export function PreviewPane(p: Props) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<Device>('desktop');
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showTests, setShowTests] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const exportFiles = useMemo(() => projectFiles(p.code, p.backend, p.project), [p.code, p.backend, p.project]);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const streamRef = useRef<HTMLPreElement>(null);

  const token = useMemo(() => crypto.randomUUID(), [p.code]);
  const html = useMemo(() => (p.code ? buildPreviewHtml(p.code, { token }, p.backend) : ''), [p.code, token, p.backend]);
  const sendMode = (enabled: boolean) => iframeRef.current?.contentWindow?.postMessage({ type: 'edit-mode', token, enabled }, '*');

  useEffect(() => { sendMode(editing && !p.generating && tab === 'preview'); }, [editing, p.generating, tab, token]);

  useEffect(() => {
    setRuntimeError(null);
    setSelected(null);
    if (p.code) setTab('preview');
  }, [p.code]);

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (d?.source !== 's2ui-preview') return;
      if (d.type === 'error') setRuntimeError((prev) => prev ?? String(d.message));
      if (d.type === 'ready') sendMode(editingRef.current && !p.generating);
      if (d.type === 'element-selected' && d.token === token && editingRef.current && !p.generating && Number.isInteger(d.id) && d.id >= 0) {
        try { describeElement(p.code, d.id); setSelected(d.id); } catch { setSelected(null); }
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [token, p.code, p.generating]);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [p.stream]);

  const copy = async () => {
    await navigator.clipboard.writeText(backendBootstrap(p.backend) + '\n' + p.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = (name: string, content: string, type: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const btn = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition';
  const exportProject = async () => {
    setExporting(true); setExportError('');
    try {
      const blob = await projectZip(p.code, p.backend, p.project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'sketch2ui-project.zip'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError((e as Error).message); }
    finally { setExporting(false); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <div className="flex rounded-lg bg-slate-900 p-0.5">
          <button onClick={() => setTab('preview')} className={`${btn} ${tab === 'preview' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <MonitorPlay className="h-3.5 w-3.5" /> Preview
          </button>
          <button onClick={() => setTab('code')} className={`${btn} ${tab === 'code' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Code2 className="h-3.5 w-3.5" /> Code
          </button>
        </div>

        {tab === 'preview' && (
          <div className="flex rounded-lg bg-slate-900 p-0.5">
            {(
              [
                ['desktop', Monitor],
                ['tablet', Tablet],
                ['mobile', Smartphone],
              ] as const
            ).map(([d, Icon]) => (
              <button key={d} onClick={() => setDevice(d)} title={d} className={`${btn} ${device === d ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
        <button disabled={!p.code || p.generating || tab !== 'preview'} aria-pressed={editing} onClick={() => { setEditing(!editing); setSelected(null); }} className={`${btn} ${editing ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'} disabled:opacity-40`}>Select element</button>

        <div className="ml-auto flex max-w-full flex-wrap items-center gap-1">
          <button disabled={!p.code || p.generating} onClick={() => setShowShare(true)} className={`${btn} text-slate-300 hover:bg-slate-800 disabled:opacity-40`}>Share / review</button>
          <button disabled={!p.code || p.generating} onClick={() => setShowGitHub(true)} className={`${btn} text-slate-300 hover:bg-slate-800 disabled:opacity-40`}>GitHub</button>
          <button disabled={!p.code || p.generating} onClick={() => setShowTests(true)} className={`${btn} text-slate-300 hover:bg-slate-800 disabled:opacity-40`}>Test UI</button>
          <button disabled={!p.code || exporting || p.generating} onClick={exportProject} className={`${btn} text-indigo-300 hover:bg-slate-800 disabled:opacity-40`}>{exporting ? 'Exporting…' : 'Project ZIP'}</button>
          {p.versionCount > 0 && (
            <div className="mr-1 flex items-center gap-0.5 text-xs text-slate-400">
              <button onClick={p.onPrev} disabled={p.versionIndex <= 0} className="rounded p-1 hover:bg-slate-800 disabled:opacity-30" title="Previous version">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="tabular-nums">
                v{p.versionIndex + 1}/{p.versionCount}
              </span>
              <button onClick={p.onNext} disabled={p.versionIndex >= p.versionCount - 1} className="rounded p-1 hover:bg-slate-800 disabled:opacity-30" title="Next version">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <button disabled={!p.code} onClick={copy} className={`${btn} text-slate-300 hover:bg-slate-800 disabled:opacity-30`}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button disabled={!p.code} onClick={() => download('App.jsx', backendBootstrap(p.backend) + '\n' + p.code, 'text/javascript')} className={`${btn} text-slate-300 hover:bg-slate-800 disabled:opacity-30`} title="Download App.jsx">
            <Download className="h-3.5 w-3.5" /> .jsx
          </button>
          <button disabled={!p.code} onClick={() => download('index.html', buildPreviewHtml(p.code, undefined, p.backend), 'text/html')} className={`${btn} text-slate-300 hover:bg-slate-800 disabled:opacity-30`} title="Download standalone HTML">
            <Download className="h-3.5 w-3.5" /> .html
          </button>
        </div>
      </div>

      {editing && tab === 'preview' && (selected === null ? <p className="border-b border-slate-800 px-3 py-2 text-xs text-indigo-300">Click an element in the preview to edit it. Click “Select element” again to interact with the app.</p> : <VisualEditor locks={p.locks} onToggleLock={p.onToggleLock} key={`${token}:${selected}`} code={p.code} id={selected} disabled={p.generating} onApply={p.onCodeChange} onRequest={p.onElementRequest} onClose={() => setSelected(null)} />)}

      {/* API error */}
      {!!p.locks.length && <details className="border-b border-slate-800 px-3 py-2 text-xs text-amber-200"><summary>Locked elements ({p.locks.length}) — protected in saved JSX</summary>{p.locks.map((snippet, i) => <div key={i} className="flex gap-2 py-1"><code className="min-w-0 flex-1 truncate">{snippet.slice(0, 120)}</code><button onClick={() => p.onToggleLock(snippet)}>Unlock</button></div>)}</details>}
      {exportError && <p role="alert" className="px-3 py-2 text-xs text-red-300">Export failed: {exportError}</p>}
      {p.apiError && (
        <div className="flex items-start gap-2 border-b border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1 break-words">{p.apiError}</span>
          <button onClick={p.onDismissError} className="text-red-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Body */}
      {!!screenNavigation(p.project).length && <nav aria-label="Screen navigation" className="flex flex-wrap gap-2 border-b border-slate-700 px-3 py-2">{screenNavigation(p.project).map((link, i) => <button key={i} className="rounded border border-indigo-600 px-3 py-1 text-xs" onClick={() => p.onNavigate(link.id)}>{link.label}</button>)}</nav>}
      {showTests && <TestsPanel code={p.code} backend={p.backend} onClose={() => setShowTests(false)} />}
      {showGitHub && <GitHubPanel files={exportFiles} onClose={() => setShowGitHub(false)} />}
      {showShare && <SharePanel project={p.project} backend={p.backend} onNavigate={p.onNavigate} onRequest={p.onElementRequest} onClose={() => setShowShare(false)} />}
      <div className="relative min-h-0 flex-1">
        {tab === 'preview' ? (
          p.code ? (
            <div className="flex h-full justify-center overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
              <iframe
                ref={iframeRef}
                title="Live preview"
                srcDoc={html}
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                style={{ width: WIDTH[device] }}
                className={`h-full bg-white transition-all duration-300 ${device !== 'desktop' ? 'my-3 rounded-xl border border-slate-700 shadow-2xl' : ''}`}
              />
            </div>
          ) : (
            <EmptyState hasModel={p.hasModel} onOpenSettings={p.onOpenSettings} />
          )
        ) : (
          <pre className="h-full overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-slate-300">{p.code || '// No code yet'}</pre>
        )}

        {/* Runtime error banner */}
        {runtimeError && !p.generating && tab === 'preview' && (
          <div className="absolute inset-x-3 bottom-3 flex items-start gap-3 rounded-xl border border-amber-700/60 bg-slate-900/95 p-3 text-xs text-amber-100 shadow-2xl backdrop-blur">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">The generated UI threw an error</div>
              <div className="mt-0.5 line-clamp-3 break-words font-mono text-amber-200/80">{runtimeError}</div>
            </div>
            <button onClick={() => p.onFix(runtimeError)} className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-400">
              <Wand2 className="h-3.5 w-3.5" /> Fix with AI
            </button>
            <button onClick={() => setRuntimeError(null)} className="text-amber-300 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Streaming overlay */}
        {p.generating && (
          <div className="absolute inset-0 flex flex-col bg-slate-950/85 backdrop-blur-sm">
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <div className="flex-1 text-sm text-slate-200">
                Generating with <span className="font-semibold text-indigo-300">{p.modelLabel}</span>
                <span className="ml-2 text-xs text-slate-500">{p.stream.length ? `${p.stream.length.toLocaleString()} chars` : 'reading your sketch…'}</span>
              </div>
              <button onClick={p.onStop} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-red-500 hover:text-red-300">
                <Square className="h-3 w-3" /> Stop
              </button>
            </div>
            <pre ref={streamRef} className="flex-1 overflow-auto p-4 font-mono text-[12px] leading-relaxed text-emerald-300/90">
              {p.stream.slice(-6000)}
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-emerald-400 align-middle" />
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasModel, onOpenSettings }: { hasModel: boolean; onOpenSettings: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-2xl shadow-lg shadow-indigo-500/30">✏️</div>
        <h3 className="text-lg font-semibold text-white">Your live UI will appear here</h3>
        <ol className="mt-4 space-y-2 text-left text-sm text-slate-400">
          <li className={hasModel ? 'text-slate-600 line-through' : ''}>
            1.{' '}
            <button onClick={onOpenSettings} className="text-indigo-300 underline-offset-2 hover:underline">
              Open Settings
            </button>{' '}
            → add a provider (OpenRouter / Meta / Gemini), paste your key, fetch models.
          </li>
          <li>2. Sketch boxes & labels on the canvas — or click a demo preset above.</li>
          <li>3. Press Generate (Ctrl + Enter), or turn on Live Sync.</li>
          <li>4. Iterate: type “make it dark mode”, or draw on top of the sketch.</li>
        </ol>
        <p className="mt-4 text-xs text-slate-600">Tip: write red notes with arrows on the sketch — the model treats them as instructions.</p>
      </div>
    </div>
  );
}
