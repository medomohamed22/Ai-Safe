import { tr } from '../lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import { Check, Download, ExternalLink, Eye, EyeOff, Loader2, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import type { AppSettings, ProviderConfig, ProviderType } from '../types';
import { PROVIDER_PRESETS, createProvider, fetchModels, pickDefaultModel } from '../lib/providers';
import { clearAll } from '../lib/storage';
import { DEMO_DISMISSED_KEY } from '../lib/demo';

interface Props {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onClose: () => void;
}

const TYPES: ProviderType[] = ['meta', 'openrouter', 'gemini', 'openai', 'meta-llama'];

export function SettingsModal({ settings, setSettings, onClose }: Props) {
  const [selId, setSelId] = useState<string | null>(settings.activeProviderId ?? settings.providers[0]?.id ?? null);
  const [confirmClear, setConfirmClear] = useState(false);
  const sel = settings.providers.find((p) => p.id === selId) ?? null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const add = (type: ProviderType) => {
    const preset = PROVIDER_PRESETS[type];
    // Reuse an untouched provider of the same type instead of stacking empty duplicates.
    const existing = settings.providers.find(
      (x) => x.type === type && x.name === preset.label && x.baseUrl === preset.baseUrl && x.useProxy === preset.defaultProxy && !x.apiKey && x.models.length === 0,
    );
    if (existing) {
      setSelId(existing.id);
      return;
    }
    const p = createProvider(type);
    setSettings((s) => ({ ...s, providers: [...s.providers, p] }));
    setSelId(p.id);
  };

  return (
    <div role="dialog" aria-label={tr("Settings")} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="settings-panel flex h-[min(720px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ui-text)]">{tr("Settings")}</h2>
            <p className="text-xs text-[var(--ui-muted)]">{tr("Everything is stored locally in your browser (localStorage). Keys are only sent to the provider you call.")}</p>
          </div>
          <button data-dialog-close aria-label={tr("Close settings")} onClick={onClose} className="rounded-lg p-2 text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Left column: providers + general */}
          <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-[var(--ui-border)] p-4 md:w-72 md:border-r md:border-b-0">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">{tr("Providers")}</div>
              <div className="space-y-1">
                {settings.providers.length === 0 && <div className="rounded-lg border border-dashed border-[var(--ui-border)] p-3 text-xs text-[var(--ui-muted)]">{tr("Add a provider to get started.")}</div>}
                {settings.providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelId(p.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${p.id === selId ? 'bg-[var(--ui-selected)] text-[var(--ui-text)] ring-1 ring-[var(--ui-border)]/40' : 'hover:bg-[var(--ui-hover)]'}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${p.apiKey ? 'bg-[var(--ui-selected)]' : 'bg-[var(--ui-selected)]'}`} />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.id === settings.activeProviderId && <span className="rounded bg-[var(--ui-selected)] px-1.5 text-[10px] text-[var(--ui-text)]">{tr("active")}</span>}
                    {p.demo && <span className="rounded bg-[var(--ui-selected)] px-1.5 text-[10px] text-[var(--ui-text)]">{tr("Demo")}</span>}
                    <span className="text-[11px] text-[var(--ui-muted)]">{p.models.length || ''}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => add(t)}
                    className="flex items-center gap-1 rounded-lg border border-[var(--ui-border)] px-2 py-1.5 text-xs text-[var(--ui-text)] hover:border-[var(--ui-border)] hover:text-[var(--ui-text)]"
                  >
                    <Plus className="h-3 w-3" /> {tr(PROVIDER_PRESETS[t].label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--ui-border)] pt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">{tr("Generation")}</div>
              <label className="flex items-center justify-between gap-2 py-1 text-sm">
                <span>{tr("Live Sync (auto-generate)")}</span>
                <input
                  type="checkbox"
                  checked={settings.autoSync}
                  onChange={(e) => setSettings((s) => ({ ...s, autoSync: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--ui-contrast)]"
                />
              </label>
              <label className="block py-1 text-sm">
                <div className="flex justify-between">
                  <span>{tr("Debounce")}</span>
                  <span className="text-[var(--ui-muted)]">{(settings.debounceMs / 1000).toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={800}
                  max={6000}
                  step={200}
                  value={settings.debounceMs}
                  onChange={(e) => setSettings((s) => ({ ...s, debounceMs: Number(e.target.value) }))}
                  className="w-full accent-[var(--ui-contrast)]"
                />
              </label>
              <label className="block py-1 text-sm">
                <div className="flex justify-between">
                  <span>{tr("Temperature")}</span>
                  <span className="text-[var(--ui-muted)]">{settings.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.temperature}
                  onChange={(e) => setSettings((s) => ({ ...s, temperature: Number(e.target.value) }))}
                  className="w-full accent-[var(--ui-contrast)]"
                />
              </label>
            </div>

            <div className="mt-auto border-t border-[var(--ui-border)] pt-4">
              {confirmClear ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--ui-text)]">{tr("Delete ALL local data (providers, keys, sketch, code history)?")}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        clearAll();
                        location.reload();
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--ui-selected)] px-3 py-2 text-xs font-semibold text-[var(--ui-text)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />{tr("Clear all local data")}</button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="flex items-center justify-center rounded-lg border border-[var(--ui-border)]/60 px-3 py-2 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-selected)]"
                    >{tr("Cancel")}</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--ui-border)]/60 px-3 py-2 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-selected)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />{tr(" Clear all local data")}</button>
              )}
            </div>
          </aside>

          {/* Right column: provider editor */}
          <section className="min-h-0 flex-1 overflow-y-auto p-5">
            {sel ? (
              <ProviderEditor key={sel.id} provider={sel} settings={settings} setSettings={setSettings} onDeleted={() => setSelId(null)} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[var(--ui-muted)]">
                <p className="text-sm">{tr("Add a provider (Meta Model API, OpenRouter, Gemini or any OpenAI-compatible API)")}</p>
                <p className="text-xs">{tr("then paste your API key and click “Fetch models”.")}</p>
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
  const [confirmRemove, setConfirmRemove] = useState(false);

  const update = (patch: Partial<ProviderConfig>) =>
    setSettings((s) => ({ ...s, providers: s.providers.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));

  const selectModel = (modelId: string) => setSettings((s) => ({ ...s, activeProviderId: p.id, activeModelId: modelId }));

  const remove = () => {
    if (p.demo) {
      try {
        localStorage.setItem(DEMO_DISMISSED_KEY, '1');
      } catch {
        /* Dismissal persistence is best-effort. */
      }
    }
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

  const inputCls = 'w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-border)]';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text)]">{tr(preset.label)}</div>
          <p className="mt-1 max-w-xl text-xs text-[var(--ui-muted)]">{tr(preset.hint)}</p>
          {p.demo && <p className="mt-1 max-w-xl text-xs font-medium text-[var(--ui-text)]">{tr("Demo provider: generations run on the hosted demo key. Paste your own Meta Model API key above for unrestricted use.")}</p>}
        </div>
        {confirmRemove ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ui-text)]">{tr('Remove provider "{0}"?', [p.name])}</span>
            <button onClick={remove} className="flex items-center gap-1 rounded-lg bg-[var(--ui-selected)] px-2 py-1 text-xs font-semibold text-[var(--ui-text)]">
              <Trash2 className="h-3.5 w-3.5" />{tr("Remove")}</button>
            <button onClick={() => setConfirmRemove(false)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-selected)]">{tr("Cancel")}</button>
          </div>
        ) : (
          <button onClick={() => setConfirmRemove(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--ui-text)] hover:bg-[var(--ui-selected)]">
            <Trash2 className="h-3.5 w-3.5" />{tr(" Remove")}</button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-[var(--ui-muted)]">{tr("Display name")}</span>
          <input className={inputCls} value={p.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="flex items-center justify-between text-xs text-[var(--ui-muted)]">{tr("API key")}{preset.keyUrl && (
              <a href={preset.keyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--ui-text)] hover:underline">{tr("Get a key ")}<ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
          <div className="relative">
            <input
              className={inputCls + ' pr-10 font-mono'}
              type={showKey ? 'text' : 'password'}
              value={p.apiKey}
              placeholder={p.type === 'openrouter' ? tr("sk-or-…") : p.type === 'gemini' ? tr("AIza…") : tr("sk-… / LLM|…")}
              onChange={(e) => update({ apiKey: e.target.value.trim() })}
              autoComplete="off"
              spellCheck={false}
            />
            <button aria-label={tr(showKey ? "Hide API key" : "Show API key")} onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)]">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="block space-y-1 md:col-span-2">
          <span className="text-xs text-[var(--ui-muted)]">{tr("Base URL")}</span>
          <input className={inputCls + ' font-mono'} value={p.baseUrl} onChange={(e) => update({ baseUrl: e.target.value.trim() })} />
        </label>
        <label className="flex items-start gap-2 md:col-span-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ui-contrast)]" checked={p.useProxy} onChange={(e) => update({ useProxy: e.target.checked })} />
          <span className="text-sm">{tr("Use proxy ")}<span className="text-[var(--ui-muted)]">{tr("(/api/proxy on your Vercel deployment)")}</span>
            <span className="block text-xs text-[var(--ui-muted)]">{tr("Enable if you see CORS / network errors. The proxy is stateless and only forwards to allow-listed AI hosts.")}</span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)]/40">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ui-border)] p-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg ui-primary px-3 py-2 text-sm font-medium text-[var(--ui-text)] hover:ui-primary disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : p.models.length ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {p.models.length ? tr("Refresh models") : tr("Fetch models")}
          </button>
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--ui-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr("Filter by model name…")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--ui-muted)]"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--ui-muted)]">
            <input type="checkbox" className="accent-[var(--ui-contrast)]" checked={visionOnly} onChange={(e) => setVisionOnly(e.target.checked)} />
            <Eye className="h-3.5 w-3.5 text-[var(--ui-text)]" />{tr(" Vision only")}</label>
        </div>

        {err && <div className="border-b border-[var(--ui-border)] bg-[var(--ui-selected)] px-3 py-2 text-xs text-[var(--ui-text)]">{tr(err)}</div>}

        <div className="max-h-[300px] overflow-y-auto">
          {p.models.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--ui-muted)]">{tr("No models loaded yet.")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--ui-muted)]">{tr("No models match the filter.")}</div>
          ) : (
            filtered.map((m) => {
              const active = settings.activeProviderId === p.id && settings.activeModelId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => selectModel(m.id)}
                  className={`flex w-full items-center gap-3 border-b border-[var(--ui-border)] px-3 py-2 text-left text-sm hover:bg-[var(--ui-hover)]/60 ${active ? 'bg-[var(--ui-selected)]' : ''}`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-[var(--ui-border)] ui-primary' : 'border-[var(--ui-border)]'}`}>
                    {active && <Check className="h-3 w-3 text-[var(--ui-text)]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[var(--ui-text)]">{m.name}</span>
                    {m.name !== m.id && <span className="block truncate font-mono text-[11px] text-[var(--ui-muted)]">{m.id}</span>}
                  </span>
                  {m.context ? <span className="text-[11px] text-[var(--ui-muted)]">{Math.round(m.context / 1000)}k</span> : null}
                  {m.vision === true && <span className="rounded bg-[var(--ui-selected)] px-1.5 py-0.5 text-[10px] text-[var(--ui-text)]">{tr("vision")}</span>}
                  {m.vision === false && <span className="rounded bg-[var(--ui-selected)]/40 px-1.5 py-0.5 text-[10px] text-[var(--ui-muted)]">{tr("text")}</span>}
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--ui-border)] p-3">
          <span className="text-xs text-[var(--ui-muted)]">
            {filtered.length}/{p.models.length}{tr(" models")}</span>
          <div className="flex items-center gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addManual()}
              placeholder={tr("or type a model id manually")}
              className="w-56 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--ui-border)]"
            />
            <button onClick={addManual} className="rounded-lg border border-[var(--ui-border)] px-2 py-1.5 text-xs hover:border-[var(--ui-border)]">{tr("Use")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
