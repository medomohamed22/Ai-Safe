import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { Eraser, FilePlus2, Globe, LayoutDashboard, Loader2, RefreshCw, Send, Settings, Smartphone, Sparkles, Zap, Layers, Palette, Image as ImageIcon, Cable, Columns2, PenTool, ChevronRight, Plus, ArrowUp, Command }  from 'lucide-react';

import type { AppSettings } from './types';
import { KEYS, load, loadSettings, save } from './lib/storage';
import { libraryPrompt } from './lib/componentLibrary';
import { planKey, planPrompt } from './lib/plans';
import { generate } from './lib/providers';
import { SYSTEM_PROMPT, buildUserPrompt, extractCode } from './lib/prompts';
import { PRESETS, type PresetKey } from './lib/presets';
import { ModelPicker } from './components/ModelPicker';
import { SettingsModal } from './components/SettingsModal';
import { PreviewPane } from './components/PreviewPane';
import { BackendPanel } from './components/BackendPanel';
import { backendPrompt, DEFAULT_BACKEND, type BackendConfig } from './lib/backend';
import { ScreensPanel } from './components/ScreensPanel';
import type { ScreenProject } from './lib/screens';
import { BrandPanel } from './components/BrandPanel';
import { brandPrompt, DEFAULT_BRAND, type Brand } from './lib/brand';
import { ReferencePanel, type ReferenceImage } from './components/ReferencePanel';
import { AlternativesPanel, type DesignAlternative } from './components/AlternativesPanel';
import { ReviewPage } from './components/ReviewPage';
import { assertLockedElements, lockPrompt } from './lib/visualEdit';
import { ThemeToggle, useTheme } from './components/ThemeProvider';
import { useWorkspaceAutosave } from './lib/useWorkspaceAutosave';
import { ProductivityPanel } from './components/ProductivityPanel';
import { StudioSidebar } from './components/StudioSidebar';
import { createPortal } from 'react-dom';
import { Menu, X, Maximize2, MonitorPlay, MessageSquare, PanelLeftOpen } from 'lucide-react';
import { useDialogAccessibility } from './lib/useDialogAccessibility';

const sigOf = (els: readonly any[]) =>
  els
    .filter((e) => !e.isDeleted)
    .map((e) => `${e.id}:${e.version}`)
    .join('|');

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

const QUICK_PROMPTS = ['Improve spacing', 'Make it responsive', 'Add a footer', 'Simplify the layout', 'Add a settings modal'];
const PRESET_ICONS = { dashboard: LayoutDashboard, landing: Globe, mobile: Smartphone } as const;

interface RunOpts {
  instruction?: string;
  fresh?: boolean;
  fixError?: string;
}

export default function App() {
  useDialogAccessibility();
  const [review] = useState(() => location.hash.startsWith('#review=') ? location.hash.slice(8) : null);
  return review ? <ReviewPage encoded={review} /> : <WorkspaceApp />;
}

function WorkspaceApp() {
  const workspaceSaveStatus = useWorkspaceAutosave();
  const { theme } = useTheme();
  const initialProject = useMemo<ScreenProject>(() => load(KEYS.project, { activeId: 'home', links: [], screens: [{ id: 'home', name: 'Home', versions: load(KEYS.versions, []), vIndex: load(KEYS.vIndex, -1), scene: load(KEYS.scene, null) }] }), []);
  const initialScreen = initialProject.screens.find(s => s.id === initialProject.activeId) || initialProject.screens[0];
  const [project, setProject] = useState(initialProject);
  const [screenScene, setScreenScene] = useState<any>(initialScreen.scene);
  const [reviewEnabled,setReviewEnabled] = useState(() => load('s2ui.review-before-apply',false));
  const [pendingChange,setPendingChange] = useState<{base:string;next:string;scope:string}|null>(null);
  useEffect(() => save('s2ui.review-before-apply',reviewEnabled),[reviewEnabled]);
  const [autoQuality, setAutoQuality] = useState(() => load('s2ui.quality.auto', false));
  useEffect(() => save('s2ui.quality.auto', autoQuality), [autoQuality]);
  const [showProductivity, setShowProductivity] = useState(false);
  const productivityAbort = useRef<AbortController | null>(null);
  const [showScreens, setShowScreens] = useState(false);
  const [brand, setBrand] = useState<Brand>(() => load(KEYS.brand, DEFAULT_BRAND));
  const [showBrand, setShowBrand] = useState(false);
  const [reference, setReference] = useState<ReferenceImage | null>(() => load(KEYS.reference, null));
  const [showReference, setShowReference] = useState(false);
  const [alternatives, setAlternatives] = useState<Record<string, DesignAlternative[]>>(() => load(KEYS.alternatives, {}));
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [locks, setLocks] = useState<Record<string, string[]>>(() => load(KEYS.locks, {}));
  const locksRef = useRef(locks); locksRef.current = locks;
  useEffect(() => save(KEYS.locks, locks), [locks]);
  useEffect(() => save(KEYS.alternatives, alternatives), [alternatives]);
  const referenceRef = useRef(reference); referenceRef.current = reference;
  useEffect(() => save(KEYS.reference, reference), [reference]);
  const brandRef = useRef(brand); brandRef.current = brand;
  useEffect(() => save(KEYS.brand, brand), [brand]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [versions, setVersions] = useState<string[]>(initialScreen.versions);
  const [vIndex, setVIndex] = useState<number>(() => Math.min(initialScreen.vIndex, initialScreen.versions.length - 1));
  const [generating, setGenerating] = useState(false);
  const [stream, setStream] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [prompt, setPrompt] = useState('');
  const promptRef = useRef(prompt); promptRef.current = prompt;
  const [backend, setBackend] = useState<BackendConfig>(() => load(KEYS.backend, DEFAULT_BACKEND));
  const [showBackend, setShowBackend] = useState(false);
  const backendRef = useRef(backend); backendRef.current = backend;
  useEffect(() => save(KEYS.backend, backend), [backend]);
  const liveProject = useMemo(() => ({ ...project, screens: project.screens.map(s => s.id === project.activeId ? { ...s, versions, vIndex, scene: screenScene } : s) }), [project, versions, vIndex, screenScene]);
  const projectRef = useRef(liveProject); projectRef.current = liveProject;
  useEffect(() => save(KEYS.project, liveProject), [liveProject]);

  const code = versions[vIndex] ?? '';
  const [mobilePane, setMobilePane] = useState<'sketch' | 'preview' | 'instructions'>(() => initialScreen.versions.length ? 'preview' : 'sketch');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => load('s2ui.sidebar.collapsed', false));
  const [toolsOpen, setToolsOpen] = useState(false);
  const [focusPane, setFocusPane] = useState<'both' | 'sketch' | 'preview'>('both');
  const [split, setSplit] = useState(() => Math.max(30, Math.min(65, load('s2ui.studio.split', 40))));
  const gridRef = useRef<HTMLElement>(null);
  useEffect(() => save('s2ui.sidebar.collapsed', sidebarCollapsed), [sidebarCollapsed]);
  useEffect(() => save('s2ui.studio.split', split), [split]);
  useEffect(() => {
    const media = matchMedia('(min-width: 901px)');
    const close = () => { if (media.matches) setToolsOpen(false); };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);
  const sidebar = <StudioSidebar project={liveProject} collapsed={sidebarCollapsed} busy={generating}
    autoSync={settings.autoSync} hasReference={!!reference} hasAlternatives={!!alternatives[project.activeId]?.length}
    onProductivity={() => { setToolsOpen(false); setShowProductivity(true); }} onCollapse={() => setSidebarCollapsed(v => !v)} onScreens={() => { setToolsOpen(false); setShowScreens(true); }}
    onBrand={() => { setToolsOpen(false); setShowBrand(true); }} onReference={() => { setToolsOpen(false); setShowReference(true); }}
    onBackend={() => { setToolsOpen(false); setShowBackend(true); }} onAlternatives={() => { setToolsOpen(false); generateAlternatives(); }}
    onCompare={() => { setToolsOpen(false); setShowAlternatives(true); }} onSync={() => setSettings(s => ({ ...s, autoSync: !s.autoSync }))}
    onNavigate={id => { selectScreen(id); setToolsOpen(false); }} />;

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const saveSceneRef = useRef<number | undefined>(undefined);
  const codeRef = useRef(code);
  codeRef.current = code;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const apiRef = useRef(api);
  apiRef.current = api;

  const initialData = useMemo(() => {
    const s = initialScreen.scene;
    return {
      elements: s?.elements ?? [],
      files: s?.files ?? undefined,
      appState: { viewBackgroundColor: '#ffffff', currentItemFontFamily: 5 },
      scrollToContent: true,
    } as any;
  }, []);
  const sigRef = useRef<string>(sigOf(initialData.elements));

  useEffect(() => save(KEYS.settings, settings), [settings]);
  useEffect(() => {
    save(KEYS.versions, versions);
    save(KEYS.vIndex, vIndex);
  }, [versions, vIndex]);

  const activeProvider = settings.providers.find((p) => p.id === settings.activeProviderId) ?? null;
  const hasModel = !!(activeProvider && settings.activeModelId);

  const pushVersion = (c: string) => {
    setMobilePane('preview');
    setVersions((prev) => {
      const next = [...prev.slice(0, vIndexRef.current + 1), c].slice(-30);
      setVIndex(next.length - 1);
      return next;
    });
  };
  const vIndexRef = useRef(vIndex);
  vIndexRef.current = vIndex;

  const exportSketch = async (): Promise<string | null> => {
    const a = apiRef.current;
    if (!a) return null;
    const elements = a.getSceneElements().filter((e) => !e.isDeleted);
    if (!elements.length) return null;
    const blob = await exportToBlob({
      elements,
      appState: { ...a.getAppState(), exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
      files: a.getFiles(),
      mimeType: 'image/png',
      maxWidthOrHeight: 1600,
      exportPadding: 32,
    } as any);
    return blobToDataUrl(blob);
  };

  // ------------------------------------------------------------------ generation
  const run = async (opts: RunOpts = {}) => {
    const screenId = projectRef.current.activeId;
    const s = settingsRef.current;
    const provider = s.providers.find((p) => p.id === s.activeProviderId);
    if (!provider || !s.activeModelId) {
      setApiError('Choose a provider and a model first (Settings → add API key → Fetch models).');
      setShowSettings(true);
      return;
    }
    window.clearTimeout(debounceRef.current);
    const image = opts.fixError ? null : await exportSketch();
    if (projectRef.current.activeId !== screenId) return;
    const current = opts.fresh ? '' : codeRef.current;
    const styleReference = opts.fixError ? null : referenceRef.current;
    if (!image && !styleReference && !opts.instruction?.trim() && !opts.fixError) {
      setApiError('Draw something on the canvas (or pick a demo preset) or type an instruction.');
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setMobilePane('preview');
    setGenerating(true);
    setStream('');
    setApiError(null);
    try {
      const full = await generate({
        provider,
        model: s.activeModelId,
        system: SYSTEM_PROMPT + libraryPrompt() + planPrompt(load(planKey(screenId), null)) + brandPrompt(brandRef.current) + lockPrompt(locksRef.current[screenId] || []),
        userText: buildUserPrompt({ hasImage: !!image, currentCode: current, instruction: opts.instruction || (styleReference && !image ? 'Create an interface based on the attached style reference.' : undefined), fixError: opts.fixError }) + backendPrompt(backendRef.current) + (styleReference ? `\nIMAGE ROLES: ${image ? 'Image 1 is the wireframe and controls layout. Image 2' : 'Image 1'} is a visual style reference. ${styleReference.instruction}\nDo not render designer annotations as content. Saved brand identity takes precedence over conflicting reference colors.\n` : ''),
        imageDataUrls: [image, styleReference?.dataUrl].filter((value): value is string => !!value),
        temperature: s.temperature,
        signal: ctrl.signal,
        onToken: (t) => setStream(t),
      });
      const c = extractCode(full);
      if (ctrl.signal.aborted || abortRef.current !== ctrl || projectRef.current.activeId !== screenId) return;
      if (!c || c.length < 30) throw new Error('The model did not return any code. Try a stronger vision model.');
      assertLockedElements(c, locksRef.current[screenId] || []);
      if (reviewEnabled) { setPendingChange({base:current,next:c,scope:screenId}); setShowProductivity(true); } else pushVersion(c);
      if (!reviewEnabled && autoQuality) setShowProductivity(true);
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      setApiError(e?.message || String(e));
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setGenerating(false);
      }
    }
  };
  const runRef = useRef(run);
  runRef.current = run;

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  };

  // ------------------------------------------------------------------ canvas
  const generateAlternatives = async () => {
    const s = settingsRef.current; const provider = s.providers.find(p => p.id === s.activeProviderId);
    if (!provider || !s.activeModelId) { setShowSettings(true); return; }
    const screenId = projectRef.current.activeId;
    const current = codeRef.current; const ref = referenceRef.current;
    abortRef.current?.abort(); window.clearTimeout(debounceRef.current);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setMobilePane('preview');
    setGenerating(true); setStream(''); setApiError(null); setShowAlternatives(true);
    setAlternatives(prev => ({ ...prev, [screenId]: [] }));
    try {
      const image = await exportSketch();
      if (!image && !current && !ref && !prompt.trim()) throw new Error('Draw a sketch, add a reference, or describe the interface first.');
      const basePrompt = buildUserPrompt({ hasImage: !!image, currentCode: current, instruction: prompt.trim() || 'Create the interface shown in the reference.' }) + backendPrompt(backendRef.current) + (ref ? `\n${image ? 'Image 1 is the sketch controlling layout. Image 2' : 'Image 1'} is a style reference: ${ref.instruction}` : '');
      const system = SYSTEM_PROMPT + libraryPrompt() + planPrompt(load(planKey(screenId),null)) + brandPrompt(brandRef.current) + lockPrompt(locksRef.current[screenId] || []);
      for (const [name, direction] of [['Formal', 'Professional, restrained, clear business hierarchy.'], ['Minimal', 'Minimal, spacious, clean and focused.'], ['Bold', 'Expressive typography and strong visual hierarchy.']] as const) {
        if (ctrl.signal.aborted || projectRef.current.activeId !== screenId) break;
        setStream(`Generating ${name}…\n`);
        const result = await generate({ provider, model: s.activeModelId, system, userText: `${basePrompt}\nDESIGN VARIANT: ${name}. ${direction} Keep the same content, functional behavior, backend contract and saved brand identity.`, imageDataUrls: [image, ref?.dataUrl].filter((v): v is string => !!v), temperature: s.temperature, signal: ctrl.signal, onToken: text => setStream(`${name}\n${text}`) });
        if (ctrl.signal.aborted || projectRef.current.activeId !== screenId) break;
        const code = extractCode(result); if (code.length < 30) throw new Error(`${name}: model did not return code.`);
        assertLockedElements(code, locksRef.current[screenId] || []);
        setAlternatives(prev => ({ ...prev, [screenId]: [...(prev[screenId] || []), { name, code }] }));
      }
    } catch (e) { if (!ctrl.signal.aborted) setApiError((e as Error).message); }
    finally { if (abortRef.current === ctrl) { abortRef.current = null; setGenerating(false); } }
  };

  const snapshotProject = () => {
    const a = apiRef.current;
    const scene = a ? { elements: a.getSceneElements(), files: a.getFiles() } : screenScene;
    return { ...liveProject, screens: liveProject.screens.map(s => s.id === project.activeId ? { ...s, scene } : s) };
  };
  const selectScreen = (id: string, nextProject = snapshotProject()) => {
    const screen = nextProject.screens.find(s => s.id === id);
    if (!screen) return;
    stop(); window.clearTimeout(debounceRef.current); window.clearTimeout(saveSceneRef.current);
    setProject({ ...nextProject, activeId: id }); setVersions(screen.versions); setVIndex(screen.vIndex); setScreenScene(screen.scene);
    setApiError(null); setStream(''); setPrompt('');
    sigRef.current = sigOf(screen.scene?.elements || []);
    apiRef.current?.resetScene();
    if (screen.scene?.files) apiRef.current?.addFiles(Object.values(screen.scene.files));
    apiRef.current?.updateScene({ elements: screen.scene?.elements || [] });
  };
  const addScreen = (name: string) => {
    const screen = { id: crypto.randomUUID(), name, versions: [], vIndex: -1, scene: null };
    const snapshot = snapshotProject(); selectScreen(screen.id, { ...snapshot, screens: [...snapshot.screens, screen] });
  };
  const persistScene = (elements: readonly any[], files: any) => {
    window.clearTimeout(saveSceneRef.current);
    saveSceneRef.current = window.setTimeout(() => {
      save(KEYS.scene, { elements: elements.filter((e) => !e.isDeleted), files });
      setScreenScene({ elements: elements.filter((e) => !e.isDeleted), files });
    }, 500);
  };

  const onChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    if (appState?.editingTextElement || appState?.newElement || appState?.selectedElementsAreBeingDragged) {
      window.clearTimeout(debounceRef.current);
      return;
    }
    const sig = sigOf(elements);
    if (sig === sigRef.current) return;
    sigRef.current = sig;
    persistScene(elements, files);
    if (settingsRef.current.autoSync && sig) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => runRef.current({}), settingsRef.current.debounceMs);
    }
  }, []);

  const loadPreset = (key: PresetKey) => {
    const a = apiRef.current;
    if (!a) return;
    const els = convertToExcalidrawElements(PRESETS[key].elements as any, { regenerateIds: true });
    a.updateScene({ elements: els });
    a.scrollToContent(els, { fitToContent: true, animate: true });
    sigRef.current = sigOf(a.getSceneElements());
    persistScene(a.getSceneElements(), a.getFiles());
    // let the canvas paint before exporting
    setTimeout(() => runRef.current({ fresh: true }), 150);
  };

  const clearCanvas = () => {
    const a = apiRef.current;
    if (!a) return;
    a.updateScene({ elements: [] });
    sigRef.current = '';
    save(KEYS.scene, { elements: [], files: {} });
    setScreenScene({ elements: [], files: {} });
  };

  const newProject = () => {
    if (!confirm('Start a new project? This clears the canvas and the code history.')) return;
    stop();
    clearCanvas();
    setVersions([]);
    setVIndex(-1);
    setProject({ activeId: 'home', links: [], screens: [{ id: 'home', name: 'Home', versions: [], vIndex: -1, scene: null }] });
    setAlternatives({});
    setLocks({});
    setApiError(null);
    setPrompt('');
  };

  const submitPrompt = () => {
    const text = prompt.trim();
    if (!text && !apiRef.current?.getSceneElements().length && !referenceRef.current) return;
    runRef.current({ instruction: text });
    setPrompt('');
  };

  // Ctrl/Cmd + Enter → generate
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        runRef.current({ instruction: promptRef.current.trim() || undefined });
        setPrompt('');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const modelLabel = settings.activeModelId ?? '';

  return (
    <div className="workspace-shell studio-shell" data-mobile-pane={mobilePane}>
      <header className="app-header">
        <button className="ui-icon mobile-tools-button" onClick={() => setToolsOpen(true)} aria-label="Open workspace tools"><Menu size={19} /></button>
        <div className="brand-lockup"><span className="brand-mark"><PenTool size={19} strokeWidth={1.6} /></span><div><span className="brand-name">Sketch2UI<span className="brand-period">.</span></span><span className="brand-subtitle">IDEAS INTO INTERFACES</span></div></div>
        <div className="workspace-breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{liveProject.screens.find(s => s.id === project.activeId)?.name || 'Home'}</strong></div>
        <div className="header-spacer" />
        <span className="save-indicator" title={workspaceSaveStatus}><span />{workspaceSaveStatus}</span>
        <div className="model-slot desktop-only"><ModelPicker settings={settings} onSelect={(pid, mid) => setSettings(s => ({ ...s, activeProviderId: pid, activeModelId: mid }))} onOpenSettings={() => setShowSettings(true)} /></div>
        <ThemeToggle />
        <button onClick={() => setShowSettings(true)} className="ui-icon" aria-label="Settings" title="Settings"><Settings size={18} /></button>
        <button onClick={newProject} className="ui-button header-new" aria-label="New project" title="Start a new project"><Plus size={16} /><span>New project</span></button>
      </header>

      <div className="studio-body" data-sidebar-collapsed={sidebarCollapsed}>
        <aside className="studio-sidebar" aria-label="Workspace tools">{sidebar}</aside>
        <div className="studio-content">
          <div className="studio-contextbar">
            <div><span className="studio-eyebrow">DESIGN STUDIO</span><strong>{liveProject.screens.find(s => s.id === project.activeId)?.name || 'Home'}</strong><span className="context-hint">Sketch it. Build it. Make it yours.</span></div>
            <div className="segmented desktop-layout" aria-label="Workspace layout">
              <button onClick={() => setFocusPane('both')} aria-pressed={focusPane === 'both'} aria-label="Split workspace"><Columns2 size={15} /><span>Split</span></button>
              <button onClick={() => setFocusPane('sketch')} aria-pressed={focusPane === 'sketch'} aria-label="Expand sketch"><PenTool size={15} /><span>Sketch</span></button>
              <button onClick={() => setFocusPane('preview')} aria-pressed={focusPane === 'preview'} aria-label="Expand preview"><MonitorPlay size={15} /><span>Preview</span></button>
            </div>
          </div>
      <main ref={gridRef} className="workspace-grid" data-focus={focusPane} style={{ '--studio-split': `${split}%` } as React.CSSProperties}>
        <section className="workspace-panel sketch-panel" data-mobile-active={mobilePane === 'sketch'} aria-label="Drawing workspace">
          <div className="panel-heading"><span className="panel-number">01</span><strong>Sketch</strong><span className="panel-caption">Start with a rough idea</span><button onClick={clearCanvas} className="ui-icon" aria-label="Clear sketch" title="Clear sketch"><Eraser size={16} /></button></div>
          <div className="preset-strip"><span>Start with</span>{(Object.keys(PRESETS) as PresetKey[]).map(k => { const Icon = PRESET_ICONS[k]; return <button key={k} onClick={() => loadPreset(k)} disabled={!api} className="preset-pill"><Icon size={13} />{PRESETS[k].label}</button>; })}</div>
          <div className="drawing-surface">
            <Excalidraw
              excalidrawAPI={(a) => setApi(a)}
              initialData={initialData}
              onChange={onChange}
              theme={theme as 'light' | 'dark'}
              UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
            />
          </div>
          <div className="panel-footnote"><span className="status-dot" />Your canvas, your starting point.<span className="desktop-only">Red notes become instructions.</span></div>
        </section>

        <div className="studio-divider" role="separator" aria-label="Resize drawing and preview" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={65} aria-valuenow={Math.round(split)} tabIndex={0}
          onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); setSplit(v => e.key === 'Home' ? 30 : e.key === 'End' ? 65 : Math.max(30, Math.min(65, v + (e.key === 'ArrowLeft' ? -2 : 2)))); } }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const box = gridRef.current?.getBoundingClientRect(); if (box) setSplit(Math.max(30, Math.min(65, (e.clientX - box.left) / box.width * 100))); }}
          onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}><span /></div>
        <section className="workspace-panel output-panel" data-mobile-active={mobilePane === 'preview'} aria-label="Preview workspace">
          <PreviewPane
            locks={locks[project.activeId] || []}
            onToggleLock={snippet => setLocks(prev => ({ ...prev, [project.activeId]: (prev[project.activeId] || []).includes(snippet) ? prev[project.activeId].filter(s => s !== snippet) : [...(prev[project.activeId] || []), snippet] }))}
            project={liveProject}
            onNavigate={selectScreen}
            backend={backend}
            code={code}
            generating={generating}
            stream={stream}
            modelLabel={modelLabel}
            apiError={apiError}
            versionIndex={vIndex}
            versionCount={versions.length}
            hasModel={hasModel}
            onPrev={() => setVIndex((i) => Math.max(0, i - 1))}
            onNext={() => setVIndex((i) => Math.min(versions.length - 1, i + 1))}
            onStop={stop}
            onFix={(err) => runRef.current({ fixError: err })}
            onDismissError={() => setApiError(null)}
            onOpenSettings={() => setShowSettings(true)}
            onCodeChange={code => { assertLockedElements(code, locksRef.current[project.activeId] || []); pushVersion(code); }}
            onElementRequest={(instruction) => runRef.current({ instruction })}
          />
        </section>
      </main>

      <footer className="workspace-composer" data-mobile-active={mobilePane === 'instructions'}>
        <div className="mobile-instructions-heading"><span className="studio-eyebrow">YOUR CREATIVE PARTNER</span><h2>What shall we make?</h2><p>Describe a new interface or refine the current screen.</p></div>
        <div className="composer-model"><ModelPicker settings={settings} onSelect={(pid, mid) => setSettings(s => ({ ...s, activeProviderId: pid, activeModelId: mid }))} onOpenSettings={() => setShowSettings(true)} /></div>
        <div className="composer-shell">
          <div className="prompt-row"><span className="composer-mark"><Sparkles size={18} strokeWidth={1.5} /></span>
            <input aria-label="Describe your interface" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) submitPrompt(); }} disabled={generating} placeholder={code ? 'What would you like to change?' : 'Describe your idea, or let your sketch do the talking…'} />
            <span className="composer-shortcut"><kbd>Ctrl</kbd><kbd>↵</kbd></span>
            <button onClick={() => { if (generating) stop(); else { runRef.current({ instruction: prompt.trim() || undefined }); setPrompt(''); } }} className="ui-primary send-button" aria-label={generating ? 'Stop generation' : 'Send'} title={generating ? 'Stop generation' : 'Generate interface (Ctrl + Enter)'}>{generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}<span>{generating ? 'Stop' : code ? 'Update interface' : 'Generate interface'}</span><ArrowUp size={16} /></button>
          </div>
          <div className="composer-bottom"><div className="quick-prompts">{(code ? QUICK_PROMPTS : ['A clean dashboard', 'A portfolio homepage', 'A mobile shopping app']).map(q => <button key={q} disabled={generating} onClick={() => { setPrompt(q); document.querySelector<HTMLInputElement>('footer input')?.focus(); }} className="quick-prompt">{q}</button>)}</div><span className="composer-note">Make something worth making.</span></div>
        </div>
        <div className="workspace-status"><span>{generating ? 'Bringing your idea to life…' : 'A little sketch. A lot of possibility.'}</span><div>{code ? <span>{versions.length} saved version{versions.length === 1 ? '' : 's'}</span> : <span>Ready when you are</span>}<span className="status-dot" /><span>Sketch → build → refine</span></div></div>
      </footer>

        </div>
      </div>
      <nav className="mobile-studio-nav" aria-label="Workspace navigation">
        <button aria-label="Show sketch workspace" aria-pressed={mobilePane === 'sketch'} onClick={() => setMobilePane('sketch')}><PenTool size={20} /><span>Sketch</span></button>
        <button aria-label="Show preview workspace" aria-pressed={mobilePane === 'preview'} onClick={() => setMobilePane('preview')}><MonitorPlay size={20} /><span>Preview</span></button>
        <button aria-label="Show instructions workspace" aria-pressed={mobilePane === 'instructions'} onClick={() => setMobilePane('instructions')}><MessageSquare size={20} /><span>Instructions</span>{generating && <i />}</button>
      </nav>
      {toolsOpen && createPortal(<div role="dialog" aria-modal="true" aria-label="Workspace tools" className="studio-tools-overlay items-center"><section className="studio-tools-sheet"><div className="sheet-heading"><strong>Workspace tools</strong><button className="ui-icon" data-dialog-close onClick={() => setToolsOpen(false)} aria-label="Close workspace tools"><X size={20} /></button></div>{sidebar}</section></div>, document.body)}
      {showProductivity && <ProductivityPanel reviewEnabled={reviewEnabled} onReviewEnabled={setReviewEnabled} review={pendingChange} onRejectReview={() => setPendingChange(null)} onAcceptReview={(next,base) => { if (codeRef.current !== base || pendingChange && pendingChange.scope !== project.activeId) throw new Error('Source or screen changed. Reject this stale review and regenerate.'); assertLockedElements(next,locksRef.current[project.activeId]||[]); pushVersion(next); setPendingChange(null); }} getSketch={exportSketch} model={settings.activeModelId || ''} reference={reference?.dataUrl} scope={project.activeId} autoQuality={autoQuality} onAutoQuality={setAutoQuality} code={code} backend={backend} onClose={() => { productivityAbort.current?.abort(); setShowProductivity(false); }} onAdopt={next => { assertLockedElements(next, locksRef.current[project.activeId] || []); pushVersion(next); }} ask={async (userText, system, images) => {
        const s = settingsRef.current; const provider = s.providers.find(p => p.id === s.activeProviderId);
        if (!provider || !s.activeModelId) throw new Error('Connect a provider and model in Settings first.');
        productivityAbort.current?.abort(); const ctrl = new AbortController(); productivityAbort.current = ctrl;
        return generate({ provider, model: s.activeModelId, system: system || SYSTEM_PROMPT + libraryPrompt() + backendPrompt(backendRef.current) + brandPrompt(brandRef.current) + lockPrompt(locksRef.current[project.activeId] || []), userText, imageDataUrls: images, temperature: s.temperature, signal: ctrl.signal, onToken: () => {} });
      }} />}
      {showSettings && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
      {showBackend && <BackendPanel config={backend} onChange={setBackend} onClose={() => setShowBackend(false)} />}
      {showBrand && <BrandPanel brand={brand} onChange={setBrand} onClose={() => setShowBrand(false)} />}
      {showReference && <ReferencePanel reference={reference} onChange={setReference} onClose={() => setShowReference(false)} />}
      {showAlternatives && <AlternativesPanel error={apiError} onStop={stop} alternatives={alternatives[project.activeId] || []} backend={backend} busy={generating} onClose={() => setShowAlternatives(false)} onChoose={code => { pushVersion(code); setShowAlternatives(false); }} />}
      {showScreens && <ScreensPanel project={liveProject} onClose={() => setShowScreens(false)} onSelect={(id) => { selectScreen(id); setShowScreens(false); }} onAdd={addScreen} onRename={(id, name) => setProject(prev => ({ ...prev, screens: prev.screens.map(s => s.id === id ? { ...s, name } : s) }))} onLinks={(links) => setProject(prev => ({ ...prev, links }))} onDelete={(id) => { const snapshot = snapshotProject(); const next = { ...snapshot, screens: snapshot.screens.filter(s => s.id !== id), links: snapshot.links.filter(l => l.from !== id && l.to !== id) }; if (id === project.activeId) selectScreen(next.screens[0].id, next); else setProject(next); }} />}
    </div>
  );
}
