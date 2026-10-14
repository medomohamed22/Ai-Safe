import { Cable, Columns2, Image, Layers, Palette, PanelLeftClose, PanelLeftOpen, Plus, Zap, Gauge } from 'lucide-react';
import type { ScreenProject } from '../lib/screens';

interface Props {
  project: ScreenProject; collapsed: boolean; busy: boolean; autoSync: boolean; hasReference: boolean; hasAlternatives: boolean;
  onProductivity: () => void; onCollapse: () => void; onScreens: () => void; onBrand: () => void; onReference: () => void; onBackend: () => void;
  onAlternatives: () => void; onCompare: () => void; onSync: () => void; onNavigate: (id: string) => void;
}

export function StudioSidebar(p: Props) {
  return <>
    <div className="sidebar-title"><span>WORKSPACE</span><button className="ui-icon" onClick={p.onCollapse} aria-label={p.collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={p.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{p.collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
    <button className="sidebar-action" onClick={p.onScreens} aria-label={`Screens (${p.project.screens.length})`} title="Manage screens"><Layers size={18} /><span>Screens</span><small>{p.project.screens.length}</small></button>
    <nav className="screen-list" aria-label="Project screens">{p.project.screens.map((screen, index) => <button key={screen.id} onClick={() => p.onNavigate(screen.id)} aria-current={screen.id === p.project.activeId ? 'page' : undefined} title={screen.name}>
      <span className="screen-thumbnail" aria-hidden="true"><i /><i /><b><i /><i /></b></span><span className="screen-name">{screen.name}<small>{screen.versions.length ? `${screen.versions.length} versions` : 'Start sketching'}</small></span><span className="screen-index">{String(index + 1).padStart(2, '0')}</span>
    </button>)}</nav>
    <button className="sidebar-add" onClick={p.onScreens}><Plus size={14} /><span>Add or connect screens</span></button>
    <div className="sidebar-section-label">DESIGN & BUILD</div>
    <button className="sidebar-action" onClick={p.onBrand} aria-label="Brand" title="Brand"><Palette size={18} /><span>Brand</span></button>
    <button className="sidebar-action" onClick={p.onReference} aria-label={p.hasReference ? 'Reference ✓' : 'Reference'} title="Reference"><Image size={18} /><span>Reference</span>{p.hasReference && <small>✓</small>}</button>
    <button className="sidebar-action" onClick={p.onBackend} aria-label="Backend" title="Backend"><Cable size={18} /><span>Backend</span></button>
    <button className="sidebar-action" disabled={p.busy} onClick={p.onAlternatives} aria-label="3 designs" title="3 designs"><Columns2 size={18} /><span>3 designs</span></button>
    {p.hasAlternatives && <button className="sidebar-action" onClick={p.onCompare}><Columns2 size={18} /><span>Compare designs</span></button>}
    <button className="sidebar-action" onClick={p.onProductivity} aria-label="Productivity studio" title="Productivity studio"><Gauge size={18} /><span>Productivity</span></button>
    <div className="sidebar-bottom"><button className="sidebar-action live-toggle" onClick={p.onSync} aria-pressed={p.autoSync} aria-label={`Live Sync ${p.autoSync ? 'ON' : 'OFF'}`} title="Live Sync"><Zap size={18} /><span>Live Sync</span><span className="toggle-track"><span /></span></button><p>From a rough idea<br />to a working interface.</p></div>
  </>;
}
