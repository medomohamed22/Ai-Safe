import { tr, screenLabel } from '../lib/i18n';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus, X } from 'lucide-react';
import type { ScreenProject } from '../lib/screens';
import { screenCode } from '../lib/screens';
import { buildPreviewHtml } from '../lib/preview';
import { MAP_CARD_H, MAP_CARD_W, layoutScreens, mapBounds, resolvePositions, type MapPoint } from '../lib/screenMap';

interface View { x: number; y: number; k: number }
type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'card'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean };

// Infinite-canvas map of the project's screens: live mini previews as cards,
// navigation links drawn as connectors, drag to pan/arrange, scroll to zoom.
// Card arrangement persists through the project's mapPositions.
export function ScreenMap({ project, onClose, onSelect, onAdd, onPositions }: {
  project: ScreenProject;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onPositions: (positions: Record<string, MapPoint>) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, MapPoint>>(() => resolvePositions(project));
  const [view, setView] = useState<View>({ x: 40, y: 40, k: 0.85 });
  const dragRef = useRef<Drag | null>(null);
  const suppressOpenRef = useRef(false);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const layout = useMemo(() => layoutScreens(project), [project]);
  const effective = useMemo(() => ({ ...layout, ...positions }), [layout, positions]);
  const previews = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of project.screens) {
      const code = screenCode(s);
      if (code) { try { map[s.id] = buildPreviewHtml(code); } catch { /* invalid code shows as empty */ } }
    }
    return map;
  }, [project]);

  const fitView = (pts: Record<string, MapPoint>) => {
    const el = viewportRef.current;
    if (!el) return;
    const b = mapBounds(pts);
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const bw = Math.max(1, b.maxX - b.minX), bh = Math.max(1, b.maxY - b.minY);
    const k = Math.min(1, Math.max(0.15, Math.min((w - 90) / bw, (h - 90) / bh)));
    setView({ k, x: (w - bw * k) / 2 - b.minX * k, y: (h - bh * k) / 2 - b.minY * k });
  };
  useLayoutEffect(() => { fitView(resolvePositions(project)); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      setView(v => {
        const k = Math.min(2, Math.max(0.15, v.k * (e.deltaY < 0 ? 1.1 : 0.9)));
        return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const el = viewportRef.current;
    const cx = (el?.clientWidth || 900) / 2, cy = (el?.clientHeight || 600) / 2;
    setView(v => {
      const k = Math.min(2, Math.max(0.15, v.k * f));
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
    });
  };

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    suppressOpenRef.current = false;
    dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const startCard = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    suppressOpenRef.current = false;
    e.stopPropagation();
    const p = effective[id];
    dragRef.current = { kind: 'card', id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (d.kind === 'pan') { setView(v => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy })); return; }
    setPositions(p => ({ ...p, [d.id]: { x: d.ox + (e.clientX - d.sx) / view.k, y: d.oy + (e.clientY - d.sy) / view.k } }));
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.kind === 'card' && d.moved) { suppressOpenRef.current = true; onPositions(positionsRef.current); }
    if (d.kind === 'pan' && d.moved) suppressOpenRef.current = true;
  };
  // No pointer capture anywhere: capturing on the viewport would retarget
  // the click that follows a press, and card previews would never open.
  // A window-level pointerup still ends any drag that leaves the window.
  useEffect(() => {
    const up = () => onUp();
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  });

  const open = (id: string) => {
    if (suppressOpenRef.current) { suppressOpenRef.current = false; return; }
    onSelect(id);
  };

  return (
    <div role="dialog" aria-label={tr("Screen map")} className="screen-map">
      <div className="screen-map-bar">
        <div className="screen-map-title">{tr("Screen map")}<span>{project.screens.length} {tr("Screens")}</span></div>
        <div className="screen-map-tools">
          <button className="ui-button" onClick={onAdd}><Plus size={14} />{tr("Add screen")}</button>
          <button className="ui-icon" aria-label={tr("Zoom out")} title={tr("Zoom out")} onClick={() => zoomBy(0.85)}><Minus size={15} /></button>
          <button className="ui-button screen-map-pct" aria-label={tr("Fit view")} title={tr("Fit view")} onClick={() => fitView(effective)}>{Math.round(view.k * 100)}%</button>
          <button className="ui-icon" aria-label={tr("Zoom in")} title={tr("Zoom in")} onClick={() => zoomBy(1.18)}><Plus size={15} /></button>
          <button className="ui-icon" aria-label={tr("Fit view")} title={tr("Fit view")} onClick={() => fitView(effective)}><Maximize size={15} /></button>
          <button className="ui-icon" aria-label={tr("Close")} title={tr("Close")} onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      <div ref={viewportRef} className="screen-map-viewport"
        style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${24 * view.k}px ${24 * view.k}px` }}
        onPointerDown={startPan} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="screen-map-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="map-edges" aria-hidden="true">
            <defs>
              <marker id="map-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6 Z" className="map-arrow" />
              </marker>
            </defs>
            {project.links.map((link, i) => {
              const a = effective[link.from], b = effective[link.to];
              if (!a || !b || link.from === link.to) return null;
              const x1 = a.x + MAP_CARD_W, y1 = a.y + MAP_CARD_H / 2;
              const x2 = b.x, y2 = b.y + MAP_CARD_H / 2;
              const c = Math.max(40, Math.abs(x2 - x1) / 2);
              return (
                <g key={i}>
                  <path d={`M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`} className="map-edge" markerEnd="url(#map-arrow)" />
                  {link.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} className="map-edge-label" textAnchor="middle">{link.label}</text>}
                </g>
              );
            })}
          </svg>
          {project.screens.map(screen => {
            const p = effective[screen.id];
            return (
              <section key={screen.id} className={`map-card${screen.id === project.activeId ? ' is-active' : ''}`} style={{ left: p.x, top: p.y, width: MAP_CARD_W }}>
                <header className="map-card-head" onPointerDown={e => startCard(e, screen.id)}>
                  <span className="map-card-name">{screenLabel(screen)}</span>
                  {screen.id === project.activeId && <span className="map-badge">{tr("Current screen")}</span>}
                </header>
                <div className="map-card-preview" onClick={() => open(screen.id)}>
                  {previews[screen.id]
                    ? <iframe title={screenLabel(screen)} srcDoc={previews[screen.id]} sandbox="allow-scripts" style={{ width: 1200, height: 844, transform: 'scale(0.25)' }} />
                    : <div className="map-card-empty">{tr("Not generated yet")}</div>}
                </div>
              </section>
            );
          })}
        </div>
        <div className="screen-map-hint">{tr("Drag to pan, scroll to zoom, and drag a card by its title bar to arrange it.")}</div>
      </div>
    </div>
  );
}
