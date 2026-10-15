import { tr, screenLabel } from '../lib/i18n';
import { Cable, Columns2, Image, Layers, Palette, PanelLeftClose, PanelLeftOpen, Plus, Zap, Gauge } from 'lucide-react';
import type { ScreenProject } from '../lib/screens';

interface Props {
  project: ScreenProject; collapsed: boolean; busy: boolean; autoSync: boolean; hasReference: boolean; hasAlternatives: boolean;
  onProductivity: () => void; onCollapse: () => void; onScreens: () => void; onBrand: () => void; onReference: () => void; onBackend: () => void;
  onAlternatives: () => void; onCompare: () => void; onSync: () => void; onNavigate: (id: string) => void;
}

export function StudioSidebar(p: Props) {
  return <>
    <div className="sidebar-title"><span>{tr("WORKSPACE")}</span><button className="ui-icon" onClick={p.onCollapse} aria-label={p.collapsed ? tr("Expand sidebar") : tr("Collapse sidebar")} title={p.collapsed ? tr("Expand sidebar") : tr("Collapse sidebar")}>{p.collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
    <button className="sidebar-action" onClick={p.onScreens} aria-label={tr("Screens ({0})", [p.project.screens.length])} title={tr("Manage screens")}><Layers size={18} /><span>{tr("Screens")}</span><small>{p.project.screens.length}</small></button>
    <nav className="screen-list" aria-label={tr("Project screens")}>{p.project.screens.map((screen, index) => <button key={screen.id} onClick={() => p.onNavigate(screen.id)} aria-current={screen.id === p.project.activeId ? 'page' : undefined} title={screenLabel(screen)}>
      <span className="screen-thumbnail" aria-hidden="true"><i /><i /><b><i /><i /></b></span><span className="screen-name">{screenLabel(screen)}<small>{screen.versions.length ? tr("{0} versions", [screen.versions.length]) : tr("Start sketching")}</small></span><span className="screen-index">{String(index + 1).padStart(2, '0')}</span>
    </button>)}</nav>
    <button className="sidebar-add" onClick={p.onScreens}><Plus size={14} /><span>{tr("Add or connect screens")}</span></button>
    <div className="sidebar-section-label">{tr("DESIGN & BUILD")}</div>
    <button className="sidebar-action" onClick={p.onBrand} aria-label={tr("Brand")} title={tr("Brand")}><Palette size={18} /><span>{tr("Brand")}</span></button>
    <button className="sidebar-action" onClick={p.onReference} aria-label={p.hasReference ? tr("Reference ✓") : tr("Reference")} title={tr("Reference")}><Image size={18} /><span>{tr("Reference")}</span>{p.hasReference && <small>✓</small>}</button>
    <button className="sidebar-action" onClick={p.onBackend} aria-label={tr("Backend")} title={tr("Backend")}><Cable size={18} /><span>{tr("Backend")}</span></button>
    <button className="sidebar-action" disabled={p.busy} onClick={p.onAlternatives} aria-label={tr("3 designs")} title={tr("3 designs")}><Columns2 size={18} /><span>{tr("3 designs")}</span></button>
    {p.hasAlternatives && <button className="sidebar-action" onClick={p.onCompare}><Columns2 size={18} /><span>{tr("Compare designs")}</span></button>}
    <button className="sidebar-action" onClick={p.onProductivity} aria-label={tr("Productivity studio")} title={tr("Productivity studio")}><Gauge size={18} /><span>{tr("Productivity")}</span></button>
    <div className="sidebar-bottom"><button className="sidebar-action live-toggle" onClick={p.onSync} aria-pressed={p.autoSync} aria-label={tr("Live Sync {0}", [tr(p.autoSync ? 'ON' : 'OFF')])} title={tr("Live Sync")}><Zap size={18} /><span>{tr("Live Sync")}</span><span className="toggle-track"><span /></span></button><p>{tr("From a rough idea")}<br />{tr("to a working interface.")}</p></div>
  </>;
}
