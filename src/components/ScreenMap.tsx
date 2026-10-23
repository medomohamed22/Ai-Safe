import { tr, screenLabel } from '../lib/i18n';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, LayoutGrid, Link2, Maximize, Minus, Plus, X } from 'lucide-react';
import { exportToBlob } from '@excalidraw/excalidraw';
import type { ScreenLink, ScreenProject } from '../lib/screens';
import { screenCode } from '../lib/screens';
import { buildPreviewHtml } from '../lib/preview';
import { MAP_CARD_H, MAP_CARD_W, flowOrder, layoutScreens, mapBounds, resolvePositions, type MapPoint } from '../lib/screenMap';

interface View { x: number; y: number; k: number }
type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'card'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean };
type FrameState = 'loading' | 'ready' | 'error' | 'timeout';

// How long a card's live preview gets to boot before the sketch takes over.
// The iframe stays mounted underneath, so a late 'ready' still swaps the
// real design in — the card just never sits blank in the meantime.
const PREVIEW_TIMEOUT_MS = 7000;

const sceneSig = (scene: any) =>
  (scene?.elements || []).filter((e: any) => !e.isDeleted).map((e: any) => `${e.id}:${e.version}`).join('|');

// Infinite-canvas map of the project's screens: live mini previews as cards
// (with the screen's sketch as a resilient fallback when a preview cannot
// boot), navigation links drawn as connectors that can be created and edited
// right on the map, drag to pan/arrange, scroll to zoom. Card arrangement
// persists through the project's mapPositions.
import { pageGroupScreens } from '../lib/pageGroup';
export function ScreenMap({ project, onClose, onSelect, onAdd, onPositions, onLinks, onExportGroup }: {
  project: ScreenProject;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onPositions: (positions: Record<string, MapPoint>) => void;
  onLinks: (links: ScreenLink[]) => void;
  onExportGroup?: () => void;
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
  const order = useMemo(() => flowOrder(project), [project]);

  // Preview documents are cached by code, so unrelated project churn (scene
  // saves, renames) never rebuilds a card's iframe or restarts its boot.
  const htmlCache = useRef(new Map<string, string>());
  const previews = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of project.screens) {
      const code = screenCode(s);
      if (!code) continue;
      let html = htmlCache.current.get(code);
      if (!html) {
        try { html = buildPreviewHtml(code); htmlCache.current.set(code, html); } catch { continue; }
      }
      map[s.id] = html;
    }
    return map;
  }, [project]);

  const frameRefs = useRef(new Map<string, HTMLIFrameElement>());
  const [frameState, setFrameState] = useState<Record<string, FrameState>>({});
  const prevPreviews = useRef<Record<string, string>>({});
  // One timeout per (screen, preview HTML), kept in a ref so unrelated
  // project updates re-running this effect cannot cancel a pending timer.
  const frameTimers = useRef(new Map<string, number>());
  useEffect(() => {
    // Decide resets synchronously against prevPreviews: a state updater runs
    // later, after the ref below already points at the new previews, and
    // would never see a difference.
    const changed: string[] = [];
    const removed: string[] = [];
    for (const s of project.screens) {
      if (previews[s.id] && prevPreviews.current[s.id] !== previews[s.id]) changed.push(s.id);
      if (!previews[s.id]) removed.push(s.id);
    }
    if (changed.length || removed.length) {
      setFrameState(cur => {
        const next = { ...cur };
        for (const id of changed) next[id] = 'loading';
        for (const id of removed) delete next[id];
        return next;
      });
    }
    for (const s of project.screens) {
      const html = previews[s.id];
      if (!html) {
        const old = frameTimers.current.get(s.id);
        if (old) { window.clearTimeout(old); frameTimers.current.delete(s.id); }
        continue;
      }
      if (prevPreviews.current[s.id] === html) continue;
      const id = s.id;
      const old = frameTimers.current.get(id);
      if (old) window.clearTimeout(old);
      const t = window.setTimeout(() => {
        frameTimers.current.delete(id);
        setFrameState(cur => (cur[id] === 'loading' ? { ...cur, [id]: 'timeout' } : cur));
      }, PREVIEW_TIMEOUT_MS);
      frameTimers.current.set(id, t);
    }
    prevPreviews.current = previews;
  }, [previews, project]);

  // The preview document posts 'ready' once its app mounts and 'error' when
  // it cannot — that is the signal that decides live preview vs fallback.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string } | null;
      if (!d || d.source !== 's2ui-preview') return;
      for (const [id, el] of frameRefs.current) {
        if (el.contentWindow !== e.source) continue;
        if (d.type === 'ready') setFrameState(cur => (cur[id] === 'ready' ? cur : { ...cur, [id]: 'ready' }));
        else if (d.type === 'error') setFrameState(cur => (cur[id] === 'ready' || cur[id] === 'error' ? cur : { ...cur, [id]: 'error' }));
        break;
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  // Sketch thumbnails: a PNG render of each screen's saved wireframe, via
  // the same exportToBlob path the studio uses to send sketches to the model.
  // Jobs are tracked by scene signature and never cancelled by effect
  // cleanups — the project prop changes identity often, and a cancelled
  // render would leave the card blank forever.
  const sketchJobs = useRef(new Map<string, { sig: string; url?: string }>());
  const [sketchUrls, setSketchUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    for (const s of project.screens) {
      const els = (s.scene?.elements || []).filter((e: any) => !e.isDeleted);
      if (!els.length) continue;
      const sig = sceneSig(s.scene);
      const job = sketchJobs.current.get(s.id);
      if (job && job.sig === sig) {
        if (job.url) { const url = job.url; setSketchUrls(u => (u[s.id] === url ? u : { ...u, [s.id]: url })); }
        continue;
      }
      const rec: { sig: string; url?: string } = { sig };
      sketchJobs.current.set(s.id, rec);
      exportToBlob({
        elements: els,
        appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
        files: s.scene?.files || {},
        mimeType: 'image/png',
        maxWidthOrHeight: 640,
        exportPadding: 16,
      } as any)
        .then((blob: Blob) => new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(blob);
        }))
        .then((url: string) => { rec.url = url; setSketchUrls(u => ({ ...u, [s.id]: url })); })
        .catch(() => { /* a screen without a thumbnail keeps the empty state */ });
    }
  }, [project]);

  // ------------------------------------------------------------- link editing
  const [linking, setLinking] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const editorOpen = draftTo !== null || editIndex !== null;
  const cancelEditor = () => { setDraftTo(null); setDraftLabel(''); setEditIndex(null); setEditLabel(''); };
  const exitLinking = () => { setLinking(false); setLinkFrom(null); cancelEditor(); };
  const pickCard = (id: string) => {
    if (!linkFrom) { setLinkFrom(id); return; }
    if (id === linkFrom) { setLinkFrom(null); return; }
    setEditIndex(null);
    setDraftTo(id);
  };
  const saveDraftLink = () => {
    if (!linkFrom || !draftTo || !draftLabel.trim()) return;
    onLinks([...project.links, { from: linkFrom, to: draftTo, label: draftLabel.trim() }]);
    setLinkFrom(null);
    cancelEditor();
  };
  const saveEditedLink = () => {
    if (editIndex === null || !editLabel.trim()) return;
    onLinks(project.links.map((l, i) => (i === editIndex ? { ...l, label: editLabel.trim() } : l)));
    cancelEditor();
  };
  const deleteEditedLink = () => {
    if (editIndex === null) return;
    onLinks(project.links.filter((_, i) => i !== editIndex));
    cancelEditor();
  };
  const screenName = (id: string | null) => {
    const s = project.screens.find(x => x.id === id);
    return s ? screenLabel(s) : '';
  };

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
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editorOpen) { cancelEditor(); return; }
      if (linking) { exitLinking(); return; }
      onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, linking, editorOpen]);

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

  const autoArrange = () => {
    setPositions({});
    onPositions({});
    requestAnimationFrame(() => fitView(layoutScreens(project)));
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
    if (linking) { pickCard(id); return; }
    onSelect(id);
  };

  const hint = editorOpen ? '' : linking
    ? (linkFrom ? tr('Pick the target screen') : tr('Pick the first screen'))
    : tr('Drag to pan, scroll to zoom, and drag a card by its title bar to arrange it.');

  return (
    <div role="dialog" aria-label={tr('Screen map')} className="screen-map">
      <div className="screen-map-bar">
        <div className="screen-map-title">{tr('Screen map')}<span>{project.screens.length} {tr('Screens')}</span></div>
        <div className="screen-map-tools">
          <button className="ui-button" onClick={onAdd}><Plus size={14} />{tr('Add screen')}</button>
          <button className="ui-button" aria-pressed={linking} onClick={() => (linking ? exitLinking() : (cancelEditor(), setLinking(true)))}><Link2 size={14} />{tr('Link screens')}</button>
          <button className="ui-button" disabled={!pageGroupScreens(project, project.activeId).length} title={tr('One HTML file with this page and its linked states')} onClick={() => onExportGroup?.()}><Download size={14} />{tr('Export page group')}</button>
          <button className="ui-button" onClick={autoArrange}><LayoutGrid size={14} />{tr('Auto-arrange')}</button>
          <button className="ui-icon" aria-label={tr('Zoom out')} title={tr('Zoom out')} onClick={() => zoomBy(0.85)}><Minus size={15} /></button>
          <button className="ui-button screen-map-pct" aria-label={tr('Fit view')} title={tr('Fit view')} onClick={() => fitView(effective)}>{Math.round(view.k * 100)}%</button>
          <button className="ui-icon" aria-label={tr('Zoom in')} title={tr('Zoom in')} onClick={() => zoomBy(1.18)}><Plus size={15} /></button>
          <button className="ui-icon" aria-label={tr('Fit view')} title={tr('Fit view')} onClick={() => fitView(effective)}><Maximize size={15} /></button>
          <button className="ui-icon" aria-label={tr('Close')} title={tr('Close')} onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      <div ref={viewportRef} className={`screen-map-viewport${linking ? ' is-linking' : ''}`}
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
              const d = `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`;
              return (
                <g key={i}>
                  <path d={d} className="map-edge-hit" style={{ pointerEvents: 'stroke' }}
                    onClick={e => { e.stopPropagation(); setEditIndex(i); setEditLabel(link.label); setDraftTo(null); setLinking(false); setLinkFrom(null); }} />
                  <path d={d} className={`map-edge${editIndex === i ? ' is-selected' : ''}`} markerEnd="url(#map-arrow)" />
                  {link.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} className="map-edge-label" textAnchor="middle" style={{ pointerEvents: 'none' }}>{link.label}</text>}
                </g>
              );
            })}
          </svg>
          {project.screens.map(screen => {
            const p = effective[screen.id];
            const html = previews[screen.id];
            const state = frameState[screen.id] || 'loading';
            const showFallback = !!html && state !== 'ready' && state !== 'loading';
            return (
              <section key={screen.id} onClick={() => open(screen.id)}
                className={`map-card${screen.id === project.activeId ? ' is-active' : ''}${linkFrom === screen.id ? ' is-link-source' : ''}`}
                style={{ left: p.x, top: p.y, width: MAP_CARD_W }}>
                <header className="map-card-head" onPointerDown={e => startCard(e, screen.id)}>
                  <span className="map-order" aria-hidden="true">{(order[screen.id] ?? 0) + 1}</span>
                  <span className="map-card-name">{screenLabel(screen)}</span>
                  {screen.id === project.activeId && <span className="map-badge">{tr('Current screen')}</span>}
                </header>
                <div className="map-card-preview">
                  {html
                    ? <div className="map-frame-scale"><iframe title={screenLabel(screen)} ref={el => { if (el) frameRefs.current.set(screen.id, el); else frameRefs.current.delete(screen.id); }} srcDoc={html} sandbox="allow-scripts allow-forms allow-modals allow-popups" style={{ width: 1200, height: 844 }} /></div>
                    : sketchUrls[screen.id]
                      ? <img className="map-sketch-img" src={sketchUrls[screen.id]} alt={screenLabel(screen)} draggable={false} />
                      : <div className="map-card-empty">{tr('Not generated yet')}</div>}
                  {showFallback && (
                    <div className="map-preview-overlay">
                      {sketchUrls[screen.id]
                        ? <><img className="map-sketch-img" src={sketchUrls[screen.id]} alt={screenLabel(screen)} draggable={false} /><span className="map-preview-note">{tr('Sketch preview')}</span></>
                        : <div className="map-card-empty">{tr('Preview unavailable')}</div>}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        {editorOpen && (
          <div className="map-linkbar" role="dialog" aria-label={tr('Link screens')}>
            <span className="map-linkbar-route">{draftTo ? `${screenName(linkFrom)} → ${screenName(draftTo)}` : `${screenName(project.links[editIndex!]?.from)} → ${screenName(project.links[editIndex!]?.to)}`}</span>
            <input value={draftTo ? draftLabel : editLabel} onChange={e => (draftTo ? setDraftLabel(e.target.value) : setEditLabel(e.target.value))}
              placeholder={tr('Button label')} aria-label={tr('Navigation label')} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') (draftTo ? saveDraftLink() : saveEditedLink()); }} />
            <button className="ui-button" disabled={!(draftTo ? draftLabel : editLabel).trim()} onClick={draftTo ? saveDraftLink : saveEditedLink}>{tr('Save link')}</button>
            {editIndex !== null && <button className="ui-button" onClick={deleteEditedLink}>{tr('Delete link')}</button>}
            <button className="ui-icon" aria-label={tr('Cancel')} title={tr('Cancel')} onClick={cancelEditor}><X size={15} /></button>
          </div>
        )}
        {hint && <div className="screen-map-hint">{hint}</div>}
      </div>
    </div>
  );
}
