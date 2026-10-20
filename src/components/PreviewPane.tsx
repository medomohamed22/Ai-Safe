import { tr } from '../lib/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Maximize2, Minimize2, MoreHorizontal, Eye,
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
import { materializeAssets } from '../lib/designAssets';
import { materializeLibrary } from '../lib/componentLibrary';
import { buildPreviewHtml } from '../lib/preview';
import { VisualEditor } from './VisualEditor';
import { applyElementEdit, applyElementMove, describeElement, type ElementEdit } from '../lib/visualEdit';
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
const WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };
const HEIGHT: Record<Device, number> = { desktop: 800, tablet: 900, mobile: 844 };

export function PreviewPane(p: Props) {
  const [libraryRevision, setLibraryRevision] = useState(0);
  useEffect(() => { const update = () => setLibraryRevision(v => v + 1); window.addEventListener('s2ui-library-change', update); return () => window.removeEventListener('s2ui-library-change', update); }, []);
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<Device>('desktop');
  const [fitMode, setFitMode] = useState<'fit' | 'actual'>('fit');
  const [fullScreen, setFullScreen] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGenerationDetails, setShowGenerationDetails] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [directError, setDirectError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showTests, setShowTests] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const exportFiles = useMemo(() => { try { return projectFiles(p.code, p.backend, p.project); } catch { return {}; } }, [p.code, p.backend, p.project, libraryRevision]);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const streamRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const update = () => setStageSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [tab, fullScreen]);
  useEffect(() => {
    if (!fullScreen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullScreen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [fullScreen]);
  const designWidth = device === 'desktop' ? Math.max(960, stageSize.width - 36) : WIDTH[device];
  const designHeight = HEIGHT[device];
  const fitScale = stageSize.width > 0 && stageSize.height > 0
    ? Math.min(1, (stageSize.width - 36) / designWidth, (stageSize.height - 36) / designHeight)
    : 1;
  const scale = fitMode === 'fit' ? Math.max(0.1, fitScale) : 1;

  const token = useMemo(() => crypto.randomUUID(), [p.code]);
  const html = useMemo(() => (p.code ? buildPreviewHtml(p.code, { token }, p.backend) : ''), [p.code, token, p.backend, libraryRevision]);
  const sendMode = (enabled: boolean) => iframeRef.current?.contentWindow?.postMessage({ type: 'edit-mode', token, enabled }, '*');

  useEffect(() => { sendMode(editing && !p.generating && tab === 'preview'); }, [editing, p.generating, tab, token]);

  useEffect(() => {
    setRuntimeError(null);
    setSelected(null);
    setDirectError('');
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
      if (d.type === 'element-resized' && d.token === token && editingRef.current && !p.generating && Number.isInteger(d.id) && d.id >= 0) {
        const edit: ElementEdit = {};
        if (typeof d.width === 'number' && Number.isFinite(d.width)) edit.width = Math.round(d.width);
        if (typeof d.height === 'number' && Number.isFinite(d.height)) edit.height = Math.round(d.height);
        if (edit.width !== undefined || edit.height !== undefined) {
          try { p.onCodeChange(applyElementEdit(p.code, d.id, edit)); setDirectError(''); } catch (e) { setDirectError((e as Error).message); }
        }
      }
      if (d.type === 'element-reordered' && d.token === token && editingRef.current && !p.generating && Number.isInteger(d.id) && Number.isInteger(d.targetId)) {
        try { p.onCodeChange(applyElementMove(p.code, d.id, d.targetId, !!d.before).code); setDirectError(''); } catch (e) { setDirectError((e as Error).message); }
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
      await navigator.clipboard.writeText(backendBootstrap(p.backend) + '\n' + materializeAssets(materializeLibrary(p.code)));
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
    <div className={`preview-pane${fullScreen ? ' preview-fullscreen' : ''}`} onClick={e => { if (exportMenuRef.current?.open && !exportMenuRef.current.contains(e.target as Node)) exportMenuRef.current.removeAttribute('open'); }}>
      <div className="panel-heading preview-heading"><span className="panel-number">02</span><strong>{tr("Preview")}</strong><span className="panel-caption">{p.code ? tr("Your idea, brought to life") : tr("A blank page, full of possibility")}</span>
        {p.versionCount > 0 && <div className="version-control"><button onClick={p.onPrev} disabled={p.versionIndex <= 0} className="ui-icon" title={tr("Previous version")} aria-label={tr("Previous version")}><ChevronLeft size={13} /></button><span>v{p.versionIndex + 1}<span className="version-total">/{p.versionCount}</span></span><button onClick={p.onNext} disabled={p.versionIndex >= p.versionCount - 1} className="ui-icon" title={tr("Next version")} aria-label={tr("Next version")}><ChevronRight size={13} /></button></div>}
      </div>
      <div className="preview-viewbar">
        <div className="segmented" aria-label={tr("Preview display")}><button onClick={() => setTab('preview')} aria-pressed={tab === 'preview'}><MonitorPlay size={13} />{tr("Preview")}</button><button onClick={() => setTab('code')} aria-pressed={tab === 'code'}><Code2 size={13} />{tr("Code")}</button></div>
        {tab === 'preview' && !!p.code && <div className="segmented device-switch" aria-label={tr("Preview device")}>{([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => <button key={d} onClick={() => setDevice(d)} title={tr(d)} aria-label={tr(d)} aria-pressed={device === d}><Icon size={13} /></button>)}</div>}
        {tab === 'preview' && !!p.code && <div className="preview-viewport-tools">
          <button className="ui-icon" onClick={() => setFitMode(mode => mode === 'fit' ? 'actual' : 'fit')} title={fitMode === 'fit' ? 'Show actual size with scrolling' : 'Fit the entire viewport'} aria-label={fitMode === 'fit' ? 'Actual size' : 'Fit to screen'} aria-pressed={fitMode === 'fit'}><Eye size={16}/><span className="preview-tool-text">{fitMode === 'fit' ? 'Fit' : '100%'}</span></button>
          <button className="ui-icon" onClick={() => setFullScreen(v => !v)} title={fullScreen ? 'Exit fullscreen (Esc)' : 'Expand preview'} aria-label={fullScreen ? 'Exit fullscreen' : 'Expand preview'}>{fullScreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
        </div>}
        <span className="preview-view-label">{tab === 'code' ? 'App.jsx' : `${device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Mobile'} · ${Math.round(scale * 100)}%`}</span>
      </div>
      {!!p.code && <div className="preview-actions" aria-label={tr("Preview actions")}>
        <button disabled={!p.code || p.generating || tab !== 'preview'} aria-pressed={editing} onClick={() => { setEditing(!editing); setSelected(null); }} className="ui-button element-select" title={p.generating ? tr("Wait for the current generation to finish") : tab !== 'preview' ? tr("Switch to the Preview tab to select elements") : tr("Select element")}><MousePointer2 size={13} /><span>{tr("Select element")}</span></button>

        <span className="actions-spacer" />

        <details ref={exportMenuRef} className="export-menu" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); exportMenuRef.current?.removeAttribute('open'); exportMenuRef.current?.querySelector('summary')?.focus(); } }}>
          <summary className="ui-button" aria-label={tr("Export options")}><Download size={15} /><span>{tr("Export")}</span><ChevronRight size={12} /></summary>
          <div className="export-dropdown" aria-label={tr("Export options")} onClick={e => { if ((e.target as HTMLElement).closest('button:not(:disabled)')) exportMenuRef.current?.removeAttribute('open'); }}>
            <span className="studio-eyebrow">{tr("TAKE YOUR WORK WITH YOU")}</span>
            <button disabled={!p.code || exporting || p.generating} onClick={exportProject} aria-label={exporting ? tr("Exporting…") : tr("Project ZIP")}><Download size={16} /><span>{tr("Project ZIP")}<small>{tr("Complete React + Vite project")}</small></span></button>
            <button disabled={!p.code || p.generating} onClick={() => setShowGitHub(true)} aria-label={tr("GitHub")}><Github size={16} /><span>{tr("GitHub")}<small>{tr("Review changes & create a PR")}</small></span></button>
            <hr />
            <button disabled={!p.code} onClick={copy} aria-label={copied ? tr("Copied") : tr("Copy")}>{copied ? <Check size={16} /> : <Copy size={16} />}<span>{copied ? tr("Copied") : tr("Copy JSX")}</span></button>
            <button disabled={!p.code} onClick={() => download('App.jsx', backendBootstrap(p.backend) + '\n' + materializeAssets(materializeLibrary(p.code)), 'text/javascript')} aria-label={tr(".jsx")}><FileCode2 size={16} /><span>{tr("Download JSX")}</span></button>
            <button disabled={!p.code} onClick={() => download('index.html', buildPreviewHtml(p.code, undefined, p.backend), 'text/html')} aria-label={tr(".html")}><Code2 size={16} /><span>{tr("Standalone HTML")}</span></button>
          </div>
        </details>
        <div className="preview-more-wrap">
          <button className="ui-icon" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced} aria-label="More preview tools" title="More tools"><MoreHorizontal size={18}/></button>
          {showAdvanced && <div className="preview-more-menu">
            <button disabled={p.generating} onClick={() => {setShowTests(true);setShowAdvanced(false);}}><FlaskConical size={15}/>{tr('Test UI')}</button>
            <button disabled={p.generating || !Object.keys(exportFiles).length} onClick={() => {setShowShare(true);setShowAdvanced(false);}}><Share2 size={15}/>{tr('Share')}</button>
          </div>}
        </div>
      </div>}
      {editing && tab === 'preview' && selected === null && <p className="selection-hint"><MousePointer2 size={13} />{tr("Select anything in the preview to edit its properties.")}</p>}
      {!!p.locks.length && <details className="locks-list"><summary>{tr("Locked elements (")}{p.locks.length}{tr(") — protected in saved JSX")}</summary>{p.locks.map((snippet, i) => <div key={i} className="flex gap-2 py-1"><code className="min-w-0 flex-1 truncate">{snippet.slice(0, 120)}</code><button onClick={() => p.onToggleLock(snippet)}>{tr("Unlock")}</button></div>)}</details>}
      {exportError && <p role="alert" className="mx-3 my-2 text-xs">{tr(exportError)}</p>}
      {p.apiError && <div role="alert" className="preview-error"><AlertTriangle size={15} /><span>{tr(p.apiError)}</span><button onClick={p.onDismissError} aria-label={tr("Dismiss error")}>✕</button></div>}
      {!!screenNavigation(p.project).length && <nav aria-label={tr("Screen navigation")} className="screen-navigation">{screenNavigation(p.project).map((link, i) => <button key={i} className="ui-button" onClick={() => p.onNavigate(link.id)}>{link.label}<ArrowUpRight size={12} /></button>)}</nav>}
      {showTests && createPortal(<TestsPanel code={p.code} backend={p.backend} onClose={() => setShowTests(false)} />, document.body)}
      {showGitHub && createPortal(<GitHubPanel files={exportFiles} onClose={() => setShowGitHub(false)} />, document.body)}
      {showShare && createPortal(<SharePanel project={p.project} backend={p.backend} onNavigate={p.onNavigate} onRequest={p.onElementRequest} onClose={() => setShowShare(false)} />, document.body)}
      <div className="preview-workarea"><div className="preview-stage">
        <div className="preview-tab-content" ref={stageRef} hidden={tab !== 'preview'}>{p.code ? <div className={`preview-viewport${fitMode === 'actual' ? ' is-actual' : ''}`}><div className="preview-size-placeholder" style={{ width: designWidth * scale, height: designHeight * scale }}><div className="preview-document" style={{ width: designWidth, height: designHeight, transform: `scale(${scale})` }} data-device={device}><iframe ref={iframeRef} title={tr("Live preview")} srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="preview-frame" /></div></div></div> : <EmptyState hasModel={p.hasModel} onOpenSettings={p.onOpenSettings} />}</div><div className="code-surface" hidden={tab !== 'code'}><div className="code-file-label"><FileCode2 size={13} />App.jsx<span>{tr("React / JSX")}</span></div><pre>{p.code || '// ' + tr('Your code will appear here')}</pre></div>
        {runtimeError && !p.generating && tab === 'preview' && <div className="runtime-banner"><AlertTriangle size={17} /><div><strong>{tr("Something needs a quick fix")}</strong><p>{tr(runtimeError)}</p></div><button onClick={() => p.onFix(runtimeError)} className="ui-primary"><Wand2 size={13} />{tr("Fix with AI")}</button><button onClick={() => setRuntimeError(null)} className="ui-icon" aria-label={tr("Dismiss runtime error")}>✕</button></div>}
        {p.generating && <div className="generation-overlay" role="status" aria-live="polite">
          <div className="generation-heading"><span className="generation-icon"><Sparkles size={20}/></span><div><strong>{tr("Bringing your idea to life")}</strong><p>{tr("Generating with ")}{p.modelLabel}</p></div><button onClick={p.onStop} className="ui-button"><Square size={11}/>{tr("Stop")}</button></div>
          <div className="generation-center">
            <div className="generation-art" aria-hidden="true"><div className="generation-art-sketch"><span/><span/><span/></div><Sparkles className="generation-art-spark" size={24}/><div className="generation-art-page"><span/><span/><span/><span/></div></div>
            <strong>{p.stream.length ? 'Building your interface' : 'Understanding your sketch'}</strong>
            <p>{p.stream.length ? 'Creating components and interactions…' : 'Preparing a beautiful, working preview…'}</p>
            <div className="generation-progress"><span/></div>
            <div className="generation-steps"><span className="is-active">01 · Analyze</span><span className={p.stream.length ? 'is-active' : ''}>02 · Generate</span><span>03 · Preview</span></div>
            <button className="generation-details-toggle" onClick={() => setShowGenerationDetails(v => !v)} aria-expanded={showGenerationDetails}>{showGenerationDetails ? 'Hide code details' : 'View code details'} <Code2 size={13}/></button>
            {showGenerationDetails && <pre ref={streamRef} className="generation-code">{p.stream.slice(-3000) || 'Waiting for model output…'}</pre>}
          </div>
          <span className="generation-caption">{p.stream.length ? p.stream.length.toLocaleString() + ' characters received' : 'Your project is being created'}</span>
        </div>}
      </div>
      {directError && tab === 'preview' && <p role="alert" className="direct-error">{tr(directError)}</p>}
      {editing && tab === 'preview' && selected !== null && <VisualEditor locks={p.locks} onToggleLock={p.onToggleLock} key={token + ':' + selected} code={p.code} id={selected} disabled={p.generating} onApply={p.onCodeChange} onRequest={p.onElementRequest} onClose={() => setSelected(null)} />}
      </div>
      <div className="panel-footnote preview-footnote"><span className="status-dot" />{tab === 'preview' ? tr("Interactive preview") : tr("Your generated source")}<span>{p.code ? tr("Ready to refine") : tr("Waiting for your first idea")}</span></div>
    </div>
  );
}

function EmptyState({ hasModel, onOpenSettings }: { hasModel: boolean; onOpenSettings: () => void }) {
  return <div className="empty-state"><div className="empty-state-inner">
    <div className="empty-visual" aria-hidden="true"><div className="empty-wireframe"><div className="mini-window-bar"><i /><i /><i /></div><div className="wireframe-content"><span /><span /><div><i /><i /></div><b /></div></div><span className="empty-connector">↗</span><div className="empty-output"><span>{'</>'}</span><div><i /><i /><i /></div><b>{tr("Made real")}<span /></b></div></div>
    <p className="empty-eyebrow">{tr("A SPACE FOR YOUR NEXT IDEA")}</p><h2>{tr("Draw an idea.")}<br /><em>{tr("Make it real.")}</em></h2><p className="empty-description">{tr("Turn rough sketches into thoughtful interfaces.")}<br />{tr("Start on the canvas. We'll meet you on the other side.")}</p>
    <div className="empty-steps"><span><b>1</b>{tr("Sketch")}</span><i /><span><b>2</b>{tr("Generate")}</span><i /><span><b>3</b>{tr("Refine")}</span></div>
    {!hasModel ? <button onClick={onOpenSettings} className="ui-primary empty-setup" aria-label={tr("Open Settings")}><Plus size={13} />{tr("Connect your first model")}<ArrowUpRight size={13} /></button> : <p className="model-ready"><Check size={13} />{tr("Your model is connected. You're ready to create.")}</p>}
  </div></div>;
}
