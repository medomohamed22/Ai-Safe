import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { Eraser, FilePlus2, Globe, LayoutDashboard, Loader2, RefreshCw, Send, Settings, Smartphone, Sparkles, Zap } from 'lucide-react';

import type { AppSettings } from './types';
import { KEYS, load, loadSettings, save } from './lib/storage';
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

const QUICK_PROMPTS = ['Dark mode', 'Make buttons rounded & bigger', 'Add a footer', 'More colorful', 'Add a settings modal'];
const PRESET_ICONS = { dashboard: LayoutDashboard, landing: Globe, mobile: Smartphone } as const;

interface RunOpts {
  instruction?: string;
  fresh?: boolean;
  fixError?: string;
}

export default function App() {
  const [review] = useState(() => location.hash.startsWith('#review=') ? location.hash.slice(8) : null);
  return review ? <ReviewPage encoded={review} /> : <WorkspaceApp />;
}

function WorkspaceApp() {
  const initialProject = useMemo<ScreenProject>(() => load(KEYS.project, { activeId: 'home', links: [], screens: [{ id: 'home', name: 'Home', versions: load(KEYS.versions, []), vIndex: load(KEYS.vIndex, -1), scene: load(KEYS.scene, null) }] }), []);
  const initialScreen = initialProject.screens.find(s => s.id === initialProject.activeId) || initialProject.screens[0];
  const [project, setProject] = useState(initialProject);
  const [screenScene, setScreenScene] = useState<any>(initialScreen.scene);
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
  const [backend, setBackend] = useState<BackendConfig>(() => load(KEYS.backend, DEFAULT_BACKEND));
  const [showBackend, setShowBackend] = useState(false);
  const backendRef = useRef(backend); backendRef.current = backend;
  useEffect(() => save(KEYS.backend, backend), [backend]);
  const liveProject = useMemo(() => ({ ...project, screens: project.screens.map(s => s.id === project.activeId ? { ...s, versions, vIndex, scene: screenScene } : s) }), [project, versions, vIndex, screenScene]);
  const projectRef = useRef(liveProject); projectRef.current = liveProject;
  useEffect(() => save(KEYS.project, liveProject), [liveProject]);

  const code = versions[vIndex] ?? '';

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

    setGenerating(true);
    setStream('');
    setApiError(null);
    try {
      const full = await generate({
        provider,
        model: s.activeModelId,
        system: SYSTEM_PROMPT + brandPrompt(brandRef.current) + lockPrompt(locksRef.current[screenId] || []),
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
      pushVersion(c);
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
    setGenerating(true); setStream(''); setApiError(null); setShowAlternatives(true);
    setAlternatives(prev => ({ ...prev, [screenId]: [] }));
    try {
      const image = await exportSketch();
      if (!image && !current && !ref && !prompt.trim()) throw new Error('Draw a sketch, add a reference, or describe the interface first.');
      const basePrompt = buildUserPrompt({ hasImage: !!image, currentCode: current, instruction: prompt.trim() || 'Create the interface shown in the reference.' }) + backendPrompt(backendRef.current) + (ref ? `\n${image ? 'Image 1 is the sketch controlling layout. Image 2' : 'Image 1'} is a style reference: ${ref.instruction}` : '');
      const system = SYSTEM_PROMPT + brandPrompt(brandRef.current) + lockPrompt(locksRef.current[screenId] || []);
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
  };

  const submitPrompt = () => {
    const text = prompt.trim();
    if (!text && !apiRef.current?.getSceneElements().length) return;
    runRef.current({ instruction: text });
    setPrompt('');
  };

  // Ctrl/Cmd + Enter → generate
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runRef.current({});
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const modelLabel = settings.activeModelId ?? '';

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      {/* ---------------- Header ---------------- */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="mr-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">Sketch2UI</div>
            <div className="text-[10px] text-slate-500">Live Sketch-to-UI Engine</div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5">
          <span className="px-2 text-[11px] uppercase tracking-wide text-slate-500">Demo</span>
          {(Object.keys(PRESETS) as PresetKey[]).map((k) => {
            const Icon = PRESET_ICONS[k];
            return (
              <button
                key={k}
                onClick={() => loadPreset(k)}
                disabled={!api}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40"
              >
                <Icon className="h-3.5 w-3.5" /> {PRESETS[k].label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setShowBackend(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Backend</button>
          <button onClick={() => setShowScreens(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Screens ({project.screens.length})</button>
          <button onClick={() => setShowBrand(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Brand</button>
          <button onClick={() => setShowReference(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Reference{reference ? ' ✓' : ''}</button>
          <button disabled={generating} onClick={generateAlternatives} className="rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-40">3 designs</button>
          {!!alternatives[project.activeId]?.length && <button onClick={() => setShowAlternatives(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs">Compare designs</button>}
          <button
            onClick={() => setSettings((s) => ({ ...s, autoSync: !s.autoSync }))}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              settings.autoSync ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={`Auto-generate ${settings.debounceMs / 1000}s after you stop drawing`}
          >
            <Zap className={`h-3.5 w-3.5 ${settings.autoSync ? 'fill-emerald-400' : ''}`} /> Live Sync {settings.autoSync ? 'ON' : 'OFF'}
          </button>

          <ModelPicker
            settings={settings}
            onSelect={(pid, mid) => setSettings((s) => ({ ...s, activeProviderId: pid, activeModelId: mid }))}
            onOpenSettings={() => setShowSettings(true)}
          />

          <button
            onClick={() => runRef.current({ fresh: true })}
            disabled={generating}
            title="Rebuild from scratch (ignore current code)"
            className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => runRef.current({})}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:brightness-110 disabled:opacity-60"
            title="Ctrl + Enter"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {code ? 'Update UI' : 'Generate'}
          </button>
          <button onClick={() => setShowSettings(true)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ---------------- Split workspace ---------------- */}
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="relative h-1/2 min-h-0 border-slate-800 md:h-auto md:w-1/2 md:border-r">
          <div className="absolute inset-0">
            <Excalidraw
              excalidrawAPI={(a) => setApi(a)}
              initialData={initialData}
              onChange={onChange}
              theme="light"
              UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
            />
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            <button onClick={clearCanvas} className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white">
              <Eraser className="h-3.5 w-3.5" /> Clear sketch
            </button>
            <button onClick={newProject} className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white">
              <FilePlus2 className="h-3.5 w-3.5" /> New project
            </button>
          </div>
        </section>

        <section className="h-1/2 min-h-0 md:h-auto md:w-1/2">
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

      {/* ---------------- Prompt bar ---------------- */}
      <footer className="border-t border-slate-800 bg-slate-900/60 px-3 py-2">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) submitPrompt();
              }}
              disabled={generating}
              placeholder={code ? 'Refine the UI… e.g. “switch to dark mode and make the buttons pill-shaped”' : 'Optional: describe what you want (works with or without a sketch)…'}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-500 disabled:opacity-60"
            />
            <button
              onClick={submitPrompt}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </div>
          {code && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  disabled={generating}
                  onClick={() => runRef.current({ instruction: q })}
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:border-indigo-500 hover:text-white disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>

      {showSettings && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
      {showBackend && <BackendPanel config={backend} onChange={setBackend} onClose={() => setShowBackend(false)} />}
      {showBrand && <BrandPanel brand={brand} onChange={setBrand} onClose={() => setShowBrand(false)} />}
      {showReference && <ReferencePanel reference={reference} onChange={setReference} onClose={() => setShowReference(false)} />}
      {showAlternatives && <AlternativesPanel error={apiError} onStop={stop} alternatives={alternatives[project.activeId] || []} backend={backend} busy={generating} onClose={() => setShowAlternatives(false)} onChoose={code => { pushVersion(code); setShowAlternatives(false); }} />}
      {showScreens && <ScreensPanel project={liveProject} onClose={() => setShowScreens(false)} onSelect={(id) => { selectScreen(id); setShowScreens(false); }} onAdd={addScreen} onRename={(id, name) => setProject(prev => ({ ...prev, screens: prev.screens.map(s => s.id === id ? { ...s, name } : s) }))} onLinks={(links) => setProject(prev => ({ ...prev, links }))} onDelete={(id) => { const snapshot = snapshotProject(); const next = { ...snapshot, screens: snapshot.screens.filter(s => s.id !== id), links: snapshot.links.filter(l => l.from !== id && l.to !== id) }; if (id === project.activeId) selectScreen(next.screens[0].id, next); else setProject(next); }} />}
    </div>
  );
}
