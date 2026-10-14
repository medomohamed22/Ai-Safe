import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, Search, Settings2 } from 'lucide-react';
import type { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  onSelect: (providerId: string, modelId: string) => void;
  onOpenSettings: () => void;
}

export function ModelPicker({ settings, onSelect, onOpenSettings }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const active = settings.providers.find((p) => p.id === settings.activeProviderId);
  const label = active && settings.activeModelId ? settings.activeModelId : 'Select a model';

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return settings.providers
      .map((p) => ({
        provider: p,
        models: p.models.filter((m) => !s || m.id.toLowerCase().includes(s) || m.name.toLowerCase().includes(s)),
      }))
      .filter((g) => g.models.length);
  }, [settings.providers, q]);

  const total = settings.providers.reduce((n, p) => n + p.models.length, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => (total ? setOpen((o) => !o) : onOpenSettings())}
        className="flex max-w-[280px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
        title={label}
      >
        {active && <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-300">{active.name}</span>}
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[420px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${total} models by name…`}
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto py-1">
            {groups.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">No models match “{q}”.</div>}
            {groups.map(({ provider, models }) => (
              <div key={provider.id}>
                <div className="sticky top-0 bg-slate-900/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {provider.name} · {models.length}
                </div>
                {models.slice(0, 300).map((m) => {
                  const selected = provider.id === settings.activeProviderId && m.id === settings.activeModelId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelect(provider.id, m.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-800 ${selected ? 'text-indigo-300' : 'text-slate-200'}`}
                    >
                      <Check className={`h-3.5 w-3.5 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="min-w-0 flex-1 truncate" title={m.id}>
                        {m.name !== m.id ? (
                          <>
                            {m.name} <span className="text-slate-500">· {m.id}</span>
                          </>
                        ) : (
                          m.id
                        )}
                      </span>
                      {m.vision && <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="vision" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
            className="flex w-full items-center gap-2 border-t border-slate-800 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <Settings2 className="h-4 w-4" /> Manage providers & API keys
          </button>
        </div>
      )}
    </div>
  );
}
