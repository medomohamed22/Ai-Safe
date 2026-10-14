import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Plus, Wand2, MousePointer2, Github, Share2, FlaskConical, FileCode2, Sparkles, ArrowUpRight,
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
      if (d.type === 'ready') sendMode(editingRef.current && !p.generating && tab === 'preview');
      if (d.type === 'element-selected' && d.token === token && editingRef.current && !p.generating && Number.isInteger(d.id) && d.id >= 0) {
        try { describeElement(p.code, d.id); setSelected(d.id); } catch { setSelected(null); }
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [token, p.code, p.generating, tab]);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [p.stream]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(backendBootstrap(p.backend) + '\n' + p.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setExportError('Clipboard is unavailable. Download the JSX file instead.'); }
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
    <div className="preview-pane">
      <div className="panel-heading preview-heading"><span className="panel-number">02</span><strong>Preview</strong><span className="panel-caption">{p.code ? 'Your idea, brought to life' : 'A blank page, full of possibility'}</span>
        {p.versionCount > 0 && <div className="version-control"><button onClick={p.onPrev} disabled={p.versionIndex <= 0} className="ui-icon" title="Previous version" aria-label="Previous version"><ChevronLeft size={13} /></button><span>v{p.versionIndex + 1}<span className="version-total">/{p.versionCount}</span></span><button onClick={p.onNext} disabled={p.versionIndex >= p.versionCount - 1} className="ui-icon" title="Next version" aria-label="Next version"><ChevronRight size={13} /></button></div>}
      </div>
      <div className="preview-viewbar">
        <div className="segmented" aria-label="Preview display"><button onClick={() => setTab('preview')} aria-pressed={tab === 'preview'}><MonitorPlay size={13} />Preview</button><button onClick={() => setTab('code')} aria-pressed={tab === 'code'}><Code2 size={13} />Code</button></div>
        {tab === 'preview' && <div className="segmented device-switch" aria-label="Preview device">{([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => <button key={d} onClick={() => setDevice(d)} title={d} aria-label={d} aria-pressed={device === d}><Icon size={13} /></button>)}</div>}
        <span className="preview-view-label">{tab === 'code' ? 'App.jsx' : device === 'desktop' ? 'Fit to workspace' : WIDTH[device]}</span>
      </div>
      <div className="preview-actions" aria-label="Preview actions">
        <button disabled={!p.code || p.generating || tab !== 'preview'} aria-pressed={editing} onClick={() => { setEditing(!editing); setSelected(null); }} className="ui-button element-select"><MousePointer2 size={13} /><span>Select element</span></button>
        <button disabled={!p.code || p.generating} onClick={() => setShowTests(true)} className="ui-icon" aria-label="Test UI" title="Test UI"><FlaskConical size={15} /></button>
        <span className="actions-spacer" />
        <button disabled={!p.code} onClick={copy} className="ui-icon" aria-label={copied ? 'Copied' : 'Copy'} title={copied ? 'Copied to clipboard' : 'Copy JSX'}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
        <button disabled={!p.code} onClick={() => download('App.jsx', backendBootstrap(p.backend) + '\n' + p.code, 'text/javascript')} className="ui-icon file-button" aria-label=".jsx" title="Download App.jsx"><span>JSX</span></button>
        <button disabled={!p.code} onClick={() => download('index.html', buildPreviewHtml(p.code, undefined, p.backend), 'text/html')} className="ui-icon file-button" aria-label=".html" title="Download standalone HTML"><span>HTML</span></button>
        <span className="tool-divider" />
        <button disabled={!p.code || p.generating} onClick={() => setShowShare(true)} className="ui-icon" aria-label="Share / review" title="Share / review"><Share2 size={15} /></button>
        <button disabled={!p.code || p.generating} onClick={() => setShowGitHub(true)} className="ui-icon" aria-label="GitHub" title="Export to GitHub"><Github size={15} /></button>
        <button disabled={!p.code || exporting || p.generating} onClick={exportProject} className="ui-button export-project" aria-label={exporting ? 'Exporting…' : 'Project ZIP'} title="Download a complete project">{exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}<span>Project ZIP</span></button>
      </div>
      {editing && tab === 'preview' && (selected === null ? <p className="selection-hint"><MousePointer2 size={13} />Select anything in the preview. Edit its look, or ask AI to refine it.</p> : <VisualEditor locks={p.locks} onToggleLock={p.onToggleLock} key={token + ':' + selected} code={p.code} id={selected} disabled={p.generating} onApply={p.onCodeChange} onRequest={p.onElementRequest} onClose={() => setSelected(null)} />)}
      {!!p.locks.length && <details className="locks-list"><summary>Locked elements ({p.locks.length}) — protected in saved JSX</summary>{p.locks.map((snippet, i) => <div key={i} className="flex gap-2 py-1"><code className="min-w-0 flex-1 truncate">{snippet.slice(0, 120)}</code><button onClick={() => p.onToggleLock(snippet)}>Unlock</button></div>)}</details>}
      {exportError && <p role="alert" className="mx-3 my-2 text-xs">{exportError}</p>}
      {p.apiError && <div role="alert" className="preview-error"><AlertTriangle size={15} /><span>{p.apiError}</span><button onClick={p.onDismissError} aria-label="Dismiss error">✕</button></div>}
      {!!screenNavigation(p.project).length && <nav aria-label="Screen navigation" className="screen-navigation">{screenNavigation(p.project).map((link, i) => <button key={i} className="ui-button" onClick={() => p.onNavigate(link.id)}>{link.label}<ArrowUpRight size={12} /></button>)}</nav>}
      {showTests && createPortal(<TestsPanel code={p.code} backend={p.backend} onClose={() => setShowTests(false)} />, document.body)}
      {showGitHub && createPortal(<GitHubPanel files={exportFiles} onClose={() => setShowGitHub(false)} />, document.body)}
      {showShare && createPortal(<SharePanel project={p.project} backend={p.backend} onNavigate={p.onNavigate} onRequest={p.onElementRequest} onClose={() => setShowShare(false)} />, document.body)}
      <div className="preview-stage">
        <div className="preview-tab-content" hidden={tab !== 'preview'}>{p.code ? <div className="preview-document" style={{ width: WIDTH[device] }} data-device={device}><iframe ref={iframeRef} title="Live preview" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="preview-frame" /></div> : <EmptyState hasModel={p.hasModel} onOpenSettings={p.onOpenSettings} />}</div><div className="code-surface" hidden={tab !== 'code'}><div className="code-file-label"><FileCode2 size={13} />App.jsx<span>React / JSX</span></div><pre>{p.code || '// Your code will appear here'}</pre></div>
        {runtimeError && !p.generating && tab === 'preview' && <div className="runtime-banner"><AlertTriangle size={17} /><div><strong>Something needs a quick fix</strong><p>{runtimeError}</p></div><button onClick={() => p.onFix(runtimeError)} className="ui-primary"><Wand2 size={13} />Fix with AI</button><button onClick={() => setRuntimeError(null)} className="ui-icon" aria-label="Dismiss runtime error">✕</button></div>}
        {p.generating && <div className="generation-overlay"><div className="generation-heading"><span className="generation-icon"><Sparkles size={20} /></span><div><strong>Bringing your idea to life</strong><p>Generating with {p.modelLabel}</p></div><button onClick={p.onStop} className="ui-button"><Square size={11} />Stop</button></div><div className="generation-progress"><span /></div><pre ref={streamRef} className="generation-code">{p.stream.slice(-6000) || 'Reading your sketch and shaping the interface…'}<span className="generation-cursor" /></pre><span className="generation-caption">{p.stream.length ? p.stream.length.toLocaleString() + ' characters generated' : 'Good things start with a rough idea.'}</span></div>}
      </div>
      <div className="panel-footnote preview-footnote"><span className="status-dot" />{tab === 'preview' ? 'Interactive preview' : 'Your generated source'}<span>{p.code ? 'Ready to refine' : 'Waiting for your first idea'}</span></div>
    </div>
  );
}

function EmptyState({ hasModel, onOpenSettings }: { hasModel: boolean; onOpenSettings: () => void }) {
  return <div className="empty-state"><div className="empty-state-inner">
    <div className="empty-visual" aria-hidden="true"><div className="empty-wireframe"><div className="mini-window-bar"><i /><i /><i /></div><div className="wireframe-content"><span /><span /><div><i /><i /></div><b /></div></div><span className="empty-connector">↗</span><div className="empty-output"><span>{'</>'}</span><div><i /><i /><i /></div><b>Made real<span /></b></div></div>
    <p className="empty-eyebrow">A SPACE FOR YOUR NEXT IDEA</p><h2>Draw an idea.<br /><em>Make it real.</em></h2><p className="empty-description">Turn rough sketches into thoughtful interfaces.<br />Start on the canvas. We'll meet you on the other side.</p>
    <div className="empty-steps"><span><b>1</b>Sketch</span><i /><span><b>2</b>Generate</span><i /><span><b>3</b>Refine</span></div>
    {!hasModel ? <button onClick={onOpenSettings} className="ui-button empty-setup" aria-label="Open Settings"><Plus size={13} />Connect your first model<ArrowUpRight size={13} /></button> : <p className="model-ready"><Check size={13} />Your model is connected. You're ready to create.</p>}
  </div></div>;
}
