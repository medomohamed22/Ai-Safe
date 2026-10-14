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
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', escape); };
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
        className="flex max-w-[280px] items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-1.5 text-sm text-[var(--ui-text)] hover:border-[var(--ui-border)]"
        title={label}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {active && <span className="rounded bg-[var(--ui-selected)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--ui-text)]">{active.name}</span>}
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ui-muted)]" />
      </button>

      {open && (
        <div onKeyDown={e => { if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return; const options = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.model-option')); if (!options.length) return; e.preventDefault(); const index = options.indexOf(document.activeElement as HTMLButtonElement); const next = index < 0 ? (e.key === 'ArrowDown' ? 0 : options.length - 1) : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; options[next].focus(); }} className="model-popover absolute right-0 z-50 mt-2 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[var(--ui-border)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--ui-muted)]" />
            <input
              autoFocus
              aria-label="Search models"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${total} models by name…`}
              className="w-full bg-transparent text-sm text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]"
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto py-1">
            {groups.length === 0 && <div className="px-4 py-6 text-center text-sm text-[var(--ui-muted)]">No models match “{q}”.</div>}
            {groups.map(({ provider, models }) => (
              <div key={provider.id}>
                <div className="sticky top-0 bg-[var(--ui-surface)]/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
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
                        ref.current?.querySelector('button')?.focus();
                      }}
                      className={`model-option flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--ui-hover)] ${selected ? 'text-[var(--ui-text)]' : 'text-[var(--ui-text)]'}`}
                    >
                      <Check className={`h-3.5 w-3.5 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="min-w-0 flex-1 truncate" title={m.id}>
                        {m.name !== m.id ? (
                          <>
                            {m.name} <span className="text-[var(--ui-muted)]">· {m.id}</span>
                          </>
                        ) : (
                          m.id
                        )}
                      </span>
                      {m.vision && <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--ui-text)]" aria-label="vision" />}
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
            className="flex w-full items-center gap-2 border-t border-[var(--ui-border)] px-3 py-2 text-sm text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
          >
            <Settings2 className="h-4 w-4" /> Manage providers & API keys
          </button>
        </div>
      )}
    </div>
  );
}
