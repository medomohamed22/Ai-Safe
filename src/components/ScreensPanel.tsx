import { tr, screenLabel } from '../lib/i18n';
import { useState } from 'react';
import type { ScreenProject } from '../lib/screens';
export function ScreensPanel({ project, onSelect, onAdd, onRename, onDelete, onLinks, onClose }: {
  project: ScreenProject; onSelect: (id: string) => void; onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
  onLinks: (links: ScreenProject['links']) => void; onClose: () => void;
}) {
  const [name, setName] = useState(''); const [to, setTo] = useState(project.screens[0]?.id || ''); const [label, setLabel] = useState('');
  const input = 'rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2';
  return <div role="dialog" aria-label={tr("Screens and navigation")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-xl bg-[var(--ui-surface)] p-5">
    <div className="flex justify-between"><h2 className="font-bold">{tr("Screens and navigation")}</h2><button onClick={onClose}>{tr("Close")}</button></div>
    <p className="text-xs text-[var(--ui-muted)]">{tr("Each screen keeps its sketch and version history. Navigation links appear in preview and the exported project. Draw and generate each screen separately.")}</p>
    <div className="flex gap-2"><input aria-label={tr("New screen name")} className={`${input} min-w-0 flex-1`} value={name} onChange={e => setName(e.target.value)} /><button disabled={!name.trim()} className="rounded ui-primary px-3 disabled:opacity-40" onClick={() => { onAdd(name.trim()); setName(''); }}>{tr("Add screen")}</button></div>
    <ul className="space-y-2">{project.screens.map(screen => <li key={screen.id} className="flex flex-wrap items-center gap-2"><button aria-current={screen.id === project.activeId ? 'page' : undefined} className="rounded border border-[var(--ui-border)] px-3 py-2 aria-[current=page]:ui-primary" onClick={() => onSelect(screen.id)}>{tr("Open ")}{screenLabel(screen)}</button><input aria-label={tr("Rename {0}", [screen.name])} className={`${input} min-w-0 flex-1`} defaultValue={screenLabel(screen)} onBlur={e => { if (e.target.value.trim()) onRename(screen.id, e.target.value.trim()); }} /><button disabled={project.screens.length < 2} onClick={() => { if (confirm(tr("Delete {0} and its saved sketch/code?", [screen.name]))) onDelete(screen.id); }} className="text-[var(--ui-text)] disabled:opacity-30">{tr("Delete")}</button></li>)}</ul>
    <h3 className="font-semibold">{tr("Links from the current screen")}</h3>
    <div className="flex flex-wrap gap-2"><select aria-label={tr("Navigation target")} className={input} value={to} onChange={e => setTo(e.target.value)}>{project.screens.map(screen => <option key={screen.id} value={screen.id}>{screenLabel(screen)}</option>)}</select><input aria-label={tr("Navigation label")} className={`${input} min-w-0 flex-1`} placeholder={tr("Button label")} value={label} onChange={e => setLabel(e.target.value)} /><button disabled={!label.trim() || !project.screens.some(s => s.id === to)} onClick={() => { onLinks([...project.links, { from: project.activeId, to, label: label.trim() }]); setLabel(''); }} className="rounded border px-3 disabled:opacity-40">{tr("Add link")}</button></div>
    <ul>{project.links.map((link, i) => <li key={i} className="flex justify-between gap-3 py-1 text-sm"><span>{project.screens.find(s => s.id === link.from)?.name} → {link.label} → {project.screens.find(s => s.id === link.to)?.name}</span><button onClick={() => onLinks(project.links.filter((_, index) => i !== index))}>{tr("Remove")}</button></li>)}</ul>
  </section></div>;
}
