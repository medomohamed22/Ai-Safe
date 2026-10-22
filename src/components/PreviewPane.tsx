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
  Plus, Wand2, MousePointer2, Github, Share2, FlaskConical, FileCode2, Sparkles, ArrowUpRight, Rocket, SlidersHorizontal,
  RotateCcw, Columns2,
} from 'lucide-react';
import { materializeAssets } from '../lib/designAssets';
import { materializeLibrary } from '../lib/componentLibrary';
import { buildPreviewHtml } from '../lib/preview';
import { diffLines } from '../lib/sourceDiff';
import { VisualEditor } from './VisualEditor';
import { applyElementEdit, applyElementMove, describeElement, type ElementEdit } from '../lib/visualEdit';
import { projectFiles, projectZip } from '../lib/projectExport';
import type { BackendConfig } from '../lib/backend';
import type { SegmentOverlayData } from '../lib/segment';
import { backendBootstrap } from '../lib/backend';
import { TestsPanel } from './TestsPanel';
import { screenNavigation, type ScreenProject } from '../lib/screens';
import { GitHubPanel } from './GitHubPanel';
import { SharePanel } from './SharePanel';
import { PublishPanel } from './PublishPanel';
import type { Brand } from '../lib/brand';
import { load, save } from '../lib/storage';

interface Props {
  locks: string[];
  onToggleLock: (snippet: string) => void;
  project: ScreenProject;
  onNavigate: (id: string) => void;
  backend: BackendConfig;
  brand: Brand;
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
  onRetryError?: () => void;
  onOpenSettings: () => void;
  onCodeChange: (code: string) => void;
  onElementRequest: (instruction: string) => void;
  onElementAgent: (instruction: string, ids: number[], mode: 'edit' | 'insert') => void;
  onSaveToLibrary: (snippet: string, tag: string) => string;
  versions: string[];
  streamCode?: string;
  segmentOverlay?: SegmentOverlayData | null;
  onCloseSegments?: () => void;
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
  const [previewReady, setPreviewReady] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [directError, setDirectError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showTests, setShowTests] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [compare, setCompare] = useState<{ a: number; b: number } | null>(null);
  const [showPublish, setShowPublish] = useState(false);
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

  // Preview app storage (P1-01): the sandboxed document cannot keep
  // localStorage, so the editor persists each screen's app data under its
  // own key, seeds the document with it, and saves the snapshots the
  // document posts back. Keyed per screen: one project's data never
  // seeds another screen's preview.
  const storageKey = (screenId: string) => `s2ui.previewstore.v1.${screenId}`;
  const activeScreenRef = useRef(p.project.activeId);
  useEffect(() => { activeScreenRef.current = p.project.activeId; }, [p.project.activeId]);
  const readSeed = (screenId: string): Record<string, string> | null => {
    try { const raw = localStorage.getItem(storageKey(screenId)); if (!raw) return null; const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; }
  };
  const moreWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showAdvanced) return;
    const onPointer = (e: PointerEvent) => { if (moreWrapRef.current && !moreWrapRef.current.contains(e.target as Node)) setShowAdvanced(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowAdvanced(false); moreWrapRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [showAdvanced]);
  const [showTweaks, setShowTweaks] = useState(false);
  const tweaksWrapRef = useRef<HTMLDivElement>(null);
  const [tweaks, setTweaks] = useState<{ font: string; compact: boolean }>(() => load('s2ui.tweaks.v1', { font: '', compact: false }));
  useEffect(() => { save('s2ui.tweaks.v1', tweaks); }, [tweaks]);
  useEffect(() => {
    if (!showTweaks) return;
    const onPointer = (e: PointerEvent) => { if (tweaksWrapRef.current && !tweaksWrapRef.current.contains(e.target as Node)) setShowTweaks(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowTweaks(false); tweaksWrapRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [showTweaks]);
  const themeFont = tweaks.font || (p.brand.enabled ? p.brand.font : '');
  const displayCode = p.generating && p.streamCode ? p.streamCode : p.code;
  const token = useMemo(() => crypto.randomUUID(), [displayCode]);
  const html = useMemo(() => (displayCode ? buildPreviewHtml(displayCode, { token, storageBridge: true, storageSeed: readSeed(p.project.activeId), theme: { font: themeFont || undefined, compact: tweaks.compact } }, p.backend) : ''), [displayCode, token, p.backend, libraryRevision, p.project.activeId, themeFont, tweaks.compact]);
  const sendMode = (enabled: boolean) => iframeRef.current?.contentWindow?.postMessage({ type: 'edit-mode', token, enabled }, '*');

  useEffect(() => { sendMode(editing && !p.generating && tab === 'preview'); }, [editing, p.generating, tab, token]);

  useEffect(() => {
    setRuntimeError(null);
    setSelected(null);
    setSelectedIds([]);
    setDirectError('');
    setPreviewReady(false);
    setSlowLoad(false);
    if (p.code) setTab('preview');
  }, [p.code]);

  // F3: the generated app loads its runtime from CDNs and compiles in the
  // browser, which can take a while. Until the document posts 'ready', the
  // stage shows a loading state instead of a blank white frame; after 15s
  // it explains the wait and lets the user look anyway.
  useEffect(() => {
    if (!p.code || previewReady) return;
    const t = setTimeout(() => setSlowLoad(true), 15000);
    return () => clearTimeout(t);
  }, [p.code, previewReady]);

  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (d?.source !== 's2ui-preview') return;
      if (d.type === 'error') { setRuntimeError((prev) => prev ?? String(d.message)); setPreviewReady(true); }
      if (d.type === 'ready') { setPreviewReady(true); sendMode(editingRef.current && !p.generating && tab === 'preview'); }
      if (d.type === 'storage' && d.token === token && d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
        try { const text = JSON.stringify(d.data); if (text.length <= 512000) localStorage.setItem(storageKey(activeScreenRef.current), text); } catch { /* quota or serialization: the in-document store keeps working */ }
      }
      if (d.type === 'element-selected' && d.token === token && editingRef.current && !p.generating && Number.isInteger(d.id) && d.id >= 0) {
        try {
          describeElement(p.code, d.id);
          if (d.multi && Array.isArray(d.ids)) {
            const ok = [...new Set(d.ids.filter((x: unknown) => { if (!Number.isInteger(x)) return false; try { describeElement(p.code, x as number); return true; } catch { return false; } }) as number[])];
            setSelected(d.id); setSelectedIds(ok.length ? ok : [d.id]);
          } else { setSelected(d.id); setSelectedIds([d.id]); }
        } catch { setSelected(null); setSelectedIds([]); }
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

  // Export feedback (P2-05): downloads used to be silent — the user could
  // not tell whether a file was saved or which one. Every successful
  // download names itself in a status line; failures keep the alert.
  const [exportNotice, setExportNotice] = useState('');
  useEffect(() => { if (!exportNotice) return; const t = window.setTimeout(() => setExportNotice(''), 4500); return () => window.clearTimeout(t); }, [exportNotice]);
  const noteSaved = (name: string) => setExportNotice(`${tr('Saved')} ${name}`);
  const download = (name: string, content: string, type: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click(); noteSaved(name);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const btn = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition';
  const exportProject = async () => {
    setExporting(true); setExportError('');
    try {
      const blob = await projectZip(p.code, p.backend, p.project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'sketch2ui-project.zip'; a.click(); noteSaved('sketch2ui-project.zip');
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
          <button className="ui-icon" onClick={() => setFitMode(mode => mode === 'fit' ? 'actual' : 'fit')} title={fitMode === 'fit' ? tr('Show actual size with scrolling') : tr('Fit the entire viewport')} aria-label={fitMode === 'fit' ? tr('Actual size') : tr('Fit to screen')} aria-pressed={fitMode === 'fit'}><Eye size={16}/><span className="preview-tool-text">{fitMode === 'fit' ? tr('Fit') : '100%'}</span></button>
          <button className="ui-icon" onClick={() => setFullScreen(v => !v)} title={fullScreen ? tr('Exit fullscreen (Esc)') : tr('Expand preview')} aria-label={fullScreen ? tr('Exit fullscreen') : tr('Expand preview')}>{fullScreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
        </div>}
        <span className="preview-view-label">{tab === 'code' ? 'App.jsx' : `${tr(device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Mobile')} · ${Math.round(scale * 100)}%`}</span>
      </div>
      {!!p.code && <div className="preview-actions" aria-label={tr("Preview actions")}>
        <button disabled={!p.code || p.generating || tab !== 'preview'} aria-pressed={editing} onClick={() => { setEditing(!editing); setSelected(null); setSelectedIds([]); }} className="ui-button element-select" title={p.generating ? tr("Wait for the current generation to finish") : tab !== 'preview' ? tr("Switch to the Preview tab to select elements") : tr("Select element")}><MousePointer2 size={13} /><span>{tr("Select element")}</span></button>

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
        <div className="preview-more-wrap" ref={moreWrapRef}>
          <button className="ui-icon" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced} aria-label={tr("More preview tools")} title={tr("More tools")}><MoreHorizontal size={18}/></button>
          {showAdvanced && <div className="preview-more-menu">
            <button disabled={p.generating} onClick={() => {setShowTests(true);setShowAdvanced(false);}}><FlaskConical size={15}/>{tr('Test UI')}</button>
            <button disabled={p.generating || !Object.keys(exportFiles).length} onClick={() => {setShowShare(true);setShowAdvanced(false);}}><Share2 size={15}/>{tr('Share')}</button>
            <button disabled={p.generating || !p.code} onClick={() => {setShowPublish(true);setShowAdvanced(false);}}><Rocket size={15}/>{tr('Publish')}</button>
            {p.versions.length >= 2 && <button disabled={p.generating} onClick={() => {setCompare({ a: Math.max(0, p.versionIndex - 1), b: p.versionIndex });setShowAdvanced(false);}}><Columns2 size={15}/>{tr('Compare versions')}</button>}
          </div>}
        </div>
        <div className="preview-tweaks-wrap" ref={tweaksWrapRef}>
          <button className="ui-icon" onClick={() => setShowTweaks(v => !v)} aria-expanded={showTweaks} aria-label={tr("Tweaks")} title={tr("Tweaks")}><SlidersHorizontal size={18}/></button>
          {showTweaks && <div className="preview-more-menu preview-tweaks-menu">
            <label>{tr("Preview font")}<select aria-label={tr("Preview font")} value={tweaks.font} onChange={e => setTweaks(t => ({ ...t, font: e.target.value }))}>
              <option value="">{tr("Design default")}</option>
              {['system-ui', 'Arial', 'Tahoma', 'Georgia', 'monospace'].map(f => <option key={f} value={f}>{f}</option>)}
            </select></label>
            <label className="tweak-check"><input type="checkbox" checked={tweaks.compact} onChange={e => setTweaks(t => ({ ...t, compact: e.target.checked }))} />{tr("Compact density")}</label>
            <p className="tweak-note">{tr("Font and density apply to the preview instantly. Colors and radius live in the design system and apply on the next generation.")}</p>
          </div>}
        </div>
      </div>}
      {editing && tab === 'preview' && selected === null && <p className="selection-hint"><MousePointer2 size={13} />{tr("Select anything in the preview to edit its properties.")}</p>}
      {!!p.locks.length && <details className="locks-list"><summary>{tr("Locked elements (")}{p.locks.length}{tr(") — protected in saved JSX")}</summary>{p.locks.map((snippet, i) => <div key={i} className="flex gap-2 py-1"><code className="min-w-0 flex-1 truncate">{snippet.slice(0, 120)}</code><button onClick={() => p.onToggleLock(snippet)}>{tr("Unlock")}</button></div>)}</details>}
      {exportError && <p role="alert" className="mx-3 my-2 text-xs">{tr(exportError)}</p>}
      {exportNotice && <p role="status" className="export-notice">{exportNotice}</p>}
      {p.apiError && <div role="alert" className="preview-error"><AlertTriangle size={15} /><span>{tr(p.apiError)}</span>{p.onRetryError && <button className="preview-error-retry" onClick={p.onRetryError}><RotateCcw size={13} />{tr("Retry")}</button>}<button onClick={p.onDismissError} aria-label={tr("Dismiss error")}>✕</button></div>}
      {!!screenNavigation(p.project).length && <nav aria-label={tr("Screen navigation")} className="screen-navigation">{screenNavigation(p.project).map((link, i) => <button key={i} className="ui-button" onClick={() => p.onNavigate(link.id)}>{link.label}<ArrowUpRight size={12} /></button>)}</nav>}
      {showTests && createPortal(<TestsPanel code={p.code} backend={p.backend} onClose={() => setShowTests(false)} />, document.body)}
      {showGitHub && createPortal(<GitHubPanel files={exportFiles} onClose={() => setShowGitHub(false)} />, document.body)}
      {showPublish && createPortal(<PublishPanel project={p.project} backend={p.backend} onClose={() => setShowPublish(false)} />, document.body)}
      {showShare && createPortal(<SharePanel project={p.project} backend={p.backend} onNavigate={p.onNavigate} onRequest={p.onElementRequest} onClose={() => setShowShare(false)} />, document.body)}
      {compare && createPortal(<CompareVersions versions={p.versions} initial={compare} onClose={() => setCompare(null)} />, document.body)}
      {p.segmentOverlay && (
        <div style={{ margin: '8px 12px', border: '1px solid var(--ui-border)', borderRadius: 12, padding: 10, background: 'var(--ui-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong style={{ fontSize: 12 }}>{tr("Sketch elements")}</strong>
            <span style={{ fontSize: 11, color: 'var(--ui-muted)' }}>{p.segmentOverlay.source === 'sam-3.1' ? tr("Segmented by SAM 3.1") : tr("Segmented by the vision model (SAM 3.1 unavailable)")}</span>
            <span style={{ flex: 1 }} />
            <button onClick={p.onCloseSegments} aria-label={tr("Close")} className="ui-icon">✕</button>
          </div>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img src={p.segmentOverlay.image} alt={tr("Sketch elements")} style={{ display: 'block', maxHeight: 220, maxWidth: '100%', borderRadius: 8 }} />
            {p.segmentOverlay.boxes.map((b, i) => (
              <span key={i} style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, border: '1.5px solid #e03131', borderRadius: 3, boxSizing: 'border-box', pointerEvents: 'none' }}>
                <span style={{ position: 'absolute', top: -14, left: 0, fontSize: 9, lineHeight: '12px', background: '#e03131', color: '#fff', padding: '0 3px', borderRadius: 2, whiteSpace: 'nowrap' }}>{b.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="preview-workarea"><div className="preview-stage">
        <div className="preview-tab-content" ref={stageRef} hidden={tab !== 'preview'}>{displayCode ? <div className={`preview-viewport${fitMode === 'actual' ? ' is-actual' : ''}`}><div className="preview-size-placeholder" style={{ width: designWidth * scale, height: designHeight * scale }}><div className="preview-document" style={{ width: designWidth, height: designHeight, transform: `scale(${scale})` }} data-device={device}><iframe ref={iframeRef} title={tr("Live preview")} srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="preview-frame" /></div></div>{!previewReady && <div className="preview-loading" role="status"><Loader2 className="animate-spin" size={22} /><p>{tr("Building your app…")}</p>{slowLoad && <><p className="preview-loading-note">{tr("Still loading — the preview builds its runtime from a CDN, so a slow connection can take a while.")}</p><button className="ui-button" onClick={() => setPreviewReady(true)}>{tr("Show the preview anyway")}</button></>}</div>}{p.generating && p.streamCode && <div className="stream-live" role="status">{tr("Live building…")}</div>}</div> : <EmptyState hasModel={p.hasModel} onOpenSettings={p.onOpenSettings} />}</div><div className="code-surface" hidden={tab !== 'code'}><div className="code-file-label"><FileCode2 size={13} />App.jsx<span>{tr("React / JSX")}</span></div><pre>{p.code || '// ' + tr('Your code will appear here')}</pre></div>
        {runtimeError && !p.generating && tab === 'preview' && <div className="runtime-banner"><AlertTriangle size={17} /><div><strong>{tr("Something needs a quick fix")}</strong><p>{tr(runtimeError)}</p></div><button onClick={() => p.onFix(runtimeError)} className="ui-primary"><Wand2 size={13} />{tr("Fix with AI")}</button><button onClick={() => setRuntimeError(null)} className="ui-icon" aria-label={tr("Dismiss runtime error")}>✕</button></div>}
        {p.generating && !p.streamCode && <div className="generation-overlay" role="status" aria-live="polite">
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
      {editing && tab === 'preview' && selected !== null && <VisualEditor locks={p.locks} onToggleLock={p.onToggleLock} key={token + ':' + selectedIds.join(',')} code={p.code} id={selected} ids={selectedIds.length ? selectedIds : [selected]} disabled={p.generating} onApply={p.onCodeChange} onRequest={p.onElementRequest} onAgentRequest={p.onElementAgent} onSaveToLibrary={p.onSaveToLibrary} onClose={() => { setSelected(null); setSelectedIds([]); }} />}
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

// Version comparison (item 34): two saved versions side by side — rendered
// previews plus a line diff (sourceDiff) windowed to the changed regions.
// This is what makes the Element Agent's "only this changed" claim visible:
// pick the versions around an agent edit and the diff shows exactly it.
function CompareVersions({ versions, initial, onClose }: { versions: string[]; initial: { a: number; b: number }; onClose: () => void }) {
  const [a, setA] = useState(initial.a);
  const [b, setB] = useState(initial.b);
  const docA = useMemo(() => buildPreviewHtml(versions[a] ?? ''), [versions, a]);
  const docB = useMemo(() => buildPreviewHtml(versions[b] ?? ''), [versions, b]);
  const rows = useMemo(() => diffLines(versions[a] ?? '', versions[b] ?? ''), [versions, a, b]);
  const added = rows.filter(r => r.kind === 'add').length;
  const removed = rows.filter(r => r.kind === 'remove').length;
  const shown = useMemo(() => {
    const keep = new Set<number>();
    rows.forEach((r, i) => { if (r.kind !== 'same') for (let k = Math.max(0, i - 2); k <= Math.min(rows.length - 1, i + 2); k++) keep.add(k); });
    const out: ({ kind: 'same' | 'add' | 'remove'; text: string } | 'gap')[] = [];
    let last = -1;
    rows.forEach((r, i) => { if (!keep.has(i)) return; if (last >= 0 && i > last + 1) out.push('gap'); out.push(r); last = i; });
    return out;
  }, [rows]);
  const options = versions.map((_, i) => <option key={i} value={i}>{tr('Version {0}', [i + 1])}</option>);
  return <div role="dialog" aria-modal="true" aria-label={tr('Compare versions')} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <section className="max-h-[92vh] w-full max-w-5xl space-y-3 overflow-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{tr('Compare versions')}</h2>
        <button onClick={onClose} className="ui-button">{tr('Close')}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select aria-label={tr('Earlier version')} className="ui-input" value={a} onChange={e => setA(Number(e.target.value))}>{options}</select>
        <span aria-hidden="true">→</span>
        <select aria-label={tr('Later version')} className="ui-input" value={b} onChange={e => setB(Number(e.target.value))}>{options}</select>
        <span className="text-[var(--ui-muted)]">{tr('{0} lines changed', [added + removed])} · <span className="diff-add-text">+{added}</span> <span className="diff-remove-text">−{removed}</span></span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[{ v: a, doc: docA }, { v: b, doc: docB }].map(({ v, doc }) => <figure key={v + ':' + doc.length} className="overflow-hidden rounded-xl border border-[var(--ui-border)]">
          <figcaption className="border-b border-[var(--ui-border)] px-3 py-2 text-xs">{tr('Version {0}', [v + 1])}</figcaption>
          <iframe title={tr('Version {0}', [v + 1])} srcDoc={doc} sandbox="allow-scripts allow-forms" className="h-[36vh] w-full bg-[var(--ui-surface)]" />
        </figure>)}
      </div>
      <details>
        <summary className="cursor-pointer text-sm">{tr('Code changes')}</summary>
        {added + removed === 0 ? <p className="py-3 text-sm text-[var(--ui-muted)]">{tr('These versions are identical.')}</p> : <div className="compare-diff" dir="ltr">{shown.map((r, i) => r === 'gap' ? <div key={i} className="diff-gap">⋯</div> : <div key={i} className={r.kind === 'add' ? 'diff-add' : r.kind === 'remove' ? 'diff-remove' : ''}>{r.kind === 'add' ? '+ ' : r.kind === 'remove' ? '− ' : '  '}{r.text}</div>)}</div>}
      </details>
    </section>
  </div>;
}

