import { useEffect, useMemo, useState } from 'react';
import { Check, Download, ExternalLink, Eye, EyeOff, Loader2, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { AppSettings, ProviderConfig, ProviderType } from '../types';
import { PROVIDER_PRESETS, createProvider, fetchModels, pickDefaultModel } from '../lib/providers';
import { clearAll } from '../lib/storage';

interface Props {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onClose: () => void;
}

const TYPES: ProviderType[] = ['openrouter', 'meta', 'gemini', 'openai'];

export function SettingsModal({ settings, setSettings, onClose }: Props) {
  const [selId, setSelId] = useState<string | null>(settings.activeProviderId ?? settings.providers[0]?.id ?? null);
  const sel = settings.providers.find((p) => p.id === selId) ?? null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const add = (type: ProviderType) => {
    const p = createProvider(type);
    setSettings((s) => ({ ...s, providers: [...s.providers, p] }));
    setSelId(p.id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="flex h-[min(720px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <p className="text-xs text-slate-500">Everything is stored locally in your browser (localStorage). Keys are only sent to the provider you call.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Left column: providers + general */}
          <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-slate-800 p-4 md:w-72 md:border-r md:border-b-0">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Providers</div>
              <div className="space-y-1">
                {settings.providers.length === 0 && <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">No providers yet. Add one below 👇</div>}
                {settings.providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelId(p.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${p.id === selId ? 'bg-indigo-500/15 text-white ring-1 ring-indigo-500/40' : 'hover:bg-slate-800'}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${p.apiKey ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.id === settings.activeProviderId && <span className="rounded bg-indigo-500/20 px-1.5 text-[10px] text-indigo-300">active</span>}
                    <span className="text-[11px] text-slate-500">{p.models.length || ''}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => add(t)}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 hover:border-indigo-500 hover:text-white"
                  >
                    <Plus className="h-3 w-3" /> {PROVIDER_PRESETS[t].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Generation</div>
              <label className="flex items-center justify-between gap-2 py-1 text-sm">
                <span>Live Sync (auto-generate)</span>
                <input
                  type="checkbox"
                  checked={settings.autoSync}
                  onChange={(e) => setSettings((s) => ({ ...s, autoSync: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-500"
                />
              </label>
              <label className="block py-1 text-sm">
                <div className="flex justify-between">
                  <span>Debounce</span>
                  <span className="text-slate-400">{(settings.debounceMs / 1000).toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={800}
                  max={6000}
                  step={200}
                  value={settings.debounceMs}
                  onChange={(e) => setSettings((s) => ({ ...s, debounceMs: Number(e.target.value) }))}
                  className="w-full accent-indigo-500"
                />
              </label>
              <label className="block py-1 text-sm">
                <div className="flex justify-between">
                  <span>Temperature</span>
                  <span className="text-slate-400">{settings.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.temperature}
                  onChange={(e) => setSettings((s) => ({ ...s, temperature: Number(e.target.value) }))}
                  className="w-full accent-indigo-500"
                />
              </label>
            </div>

            <div className="mt-auto border-t border-slate-800 pt-4">
              <button
                onClick={() => {
                  if (confirm('Delete ALL local data (providers, keys, sketch, code history)?')) {
                    clearAll();
                    location.reload();
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear all local data
              </button>
            </div>
          </aside>

          {/* Right column: provider editor */}
          <section className="min-h-0 flex-1 overflow-y-auto p-5">
            {sel ? (
              <ProviderEditor key={sel.id} provider={sel} settings={settings} setSettings={setSettings} onDeleted={() => setSelId(null)} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-500">
                <p className="text-sm">Add a provider (OpenRouter, Meta Llama API, Gemini or any OpenAI-compatible API)</p>
                <p className="text-xs">then paste your API key and click “Fetch models”.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ProviderEditor({
  provider: p,
  settings,
  setSettings,
  onDeleted,
}: {
  provider: ProviderConfig;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onDeleted: () => void;
}) {
  const preset = PROVIDER_PRESETS[p.type];
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [visionOnly, setVisionOnly] = useState(false);
  const [manual, setManual] = useState('');

  const update = (patch: Partial<ProviderConfig>) =>
    setSettings((s) => ({ ...s, providers: s.providers.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));

  const selectModel = (modelId: string) => setSettings((s) => ({ ...s, activeProviderId: p.id, activeModelId: modelId }));

  const remove = () => {
    if (!confirm(`Remove provider "${p.name}"?`)) return;
    setSettings((s) => {
      const wasActive = s.activeProviderId === p.id;
      return {
        ...s,
        providers: s.providers.filter((x) => x.id !== p.id),
        activeProviderId: wasActive ? null : s.activeProviderId,
        activeModelId: wasActive ? null : s.activeModelId,
      };
    });
    onDeleted();
  };

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const models = await fetchModels(p);
      update({ models });
      if (!models.length) setErr('Provider returned 0 models.');
      // auto-select a sensible default if nothing is active yet
      if (!settings.activeModelId || settings.activeProviderId === p.id && !models.some((m) => m.id === settings.activeModelId)) {
        const def = pickDefaultModel(models);
        if (def) selectModel(def);
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const addManual = () => {
    const id = manual.trim();
    if (!id) return;
    if (!p.models.some((m) => m.id === id)) update({ models: [{ id, name: id }, ...p.models] });
    selectModel(id);
    setManual('');
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return p.models.filter((m) => (!visionOnly || m.vision) && (!s || m.id.toLowerCase().includes(s) || m.name.toLowerCase().includes(s)));
  }, [p.models, q, visionOnly]);

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-300">{preset.label}</div>
          <p className="mt-1 max-w-xl text-xs text-slate-500">{preset.hint}</p>
        </div>
        <button onClick={remove} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-950/40">
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-slate-400">Display name</span>
          <input className={inputCls} value={p.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="flex items-center justify-between text-xs text-slate-400">
            API key
            {preset.keyUrl && (
              <a href={preset.keyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-300 hover:underline">
                Get a key <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
          <div className="relative">
            <input
              className={inputCls + ' pr-10 font-mono'}
              type={showKey ? 'text' : 'password'}
              value={p.apiKey}
              placeholder={p.type === 'openrouter' ? 'sk-or-…' : p.type === 'gemini' ? 'AIza…' : 'sk-… / LLM|…'}
              onChange={(e) => update({ apiKey: e.target.value.trim() })}
              autoComplete="off"
              spellCheck={false}
            />
            <button onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="block space-y-1 md:col-span-2">
          <span className="text-xs text-slate-400">Base URL</span>
          <input className={inputCls + ' font-mono'} value={p.baseUrl} onChange={(e) => update({ baseUrl: e.target.value.trim() })} />
        </label>
        <label className="flex items-start gap-2 md:col-span-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-500" checked={p.useProxy} onChange={(e) => update({ useProxy: e.target.checked })} />
          <span className="text-sm">
            Use proxy <span className="text-slate-500">(/api/proxy on your Vercel deployment)</span>
            <span className="block text-xs text-slate-500">
              Enable if you see CORS / network errors. The proxy is stateless and only forwards to allow-listed AI hosts.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : p.models.length ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {p.models.length ? 'Refresh models' : 'Fetch models'}
          </button>
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by model name…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" className="accent-emerald-500" checked={visionOnly} onChange={(e) => setVisionOnly(e.target.checked)} />
            <Eye className="h-3.5 w-3.5 text-emerald-400" /> Vision only
          </label>
        </div>

        {err && <div className="border-b border-slate-800 bg-red-950/30 px-3 py-2 text-xs text-red-300">{err}</div>}

        <div className="max-h-[300px] overflow-y-auto">
          {p.models.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No models loaded yet.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No models match the filter.</div>
          ) : (
            filtered.map((m) => {
              const active = settings.activeProviderId === p.id && settings.activeModelId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => selectModel(m.id)}
                  className={`flex w-full items-center gap-3 border-b border-slate-900 px-3 py-2 text-left text-sm hover:bg-slate-800/60 ${active ? 'bg-indigo-500/10' : ''}`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'}`}>
                    {active && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-100">{m.name}</span>
                    {m.name !== m.id && <span className="block truncate font-mono text-[11px] text-slate-500">{m.id}</span>}
                  </span>
                  {m.context ? <span className="text-[11px] text-slate-500">{Math.round(m.context / 1000)}k</span> : null}
                  {m.vision === true && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">vision</span>}
                  {m.vision === false && <span className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[10px] text-slate-400">text</span>}
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-800 p-3">
          <span className="text-xs text-slate-500">
            {filtered.length}/{p.models.length} models
          </span>
          <div className="flex items-center gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
              placeholder="or type a model id manually"
              className="w-56 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs outline-none focus:border-indigo-500"
            />
            <button onClick={addManual} className="rounded-lg border border-slate-700 px-2 py-1.5 text-xs hover:border-indigo-500">
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
