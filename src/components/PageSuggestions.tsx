import { ArrowUpRight } from 'lucide-react';
import { tr } from '../lib/i18n';
import { PAGE_SUGGESTIONS, type PageSuggestion } from '../lib/pageSuggestions';

/** Hand-drawn-feel wireframe thumbnails: plain SVG structure drawings, one per page type. */
export function WireframeArt({ kind }: { kind: PageSuggestion['art'] }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;
  const f = { fill: 'currentColor', opacity: 0.25 } as const;
  return <svg viewBox="0 0 120 84" className="page-art-svg" aria-hidden="true">
    {kind === 'login' && <g {...s}><rect x="6" y="6" width="108" height="72" rx="6" /><rect x="40" y="14" width="40" height="56" rx="4" /><circle cx="60" cy="28" r="5" /><line x1="47" y1="42" x2="73" y2="42" /><line x1="47" y1="51" x2="73" y2="51" /><rect x="47" y="59" width="26" height="6" rx="3" {...f} stroke="none" /></g>}
    {kind === 'home' && <g {...s}><rect x="6" y="6" width="108" height="72" rx="6" /><line x1="6" y1="18" x2="114" y2="18" /><rect x="14" y="24" width="60" height="20" rx="3" {...f} stroke="none" /><rect x="14" y="52" width="28" height="18" rx="3" /><rect x="46" y="52" width="28" height="18" rx="3" /><rect x="78" y="52" width="28" height="18" rx="3" /></g>}
    {kind === 'dashboard' && <g {...s}><rect x="6" y="6" width="108" height="72" rx="6" /><line x1="30" y1="6" x2="30" y2="78" /><rect x="36" y="12" width="20" height="12" rx="2" /><rect x="60" y="12" width="20" height="12" rx="2" /><rect x="84" y="12" width="24" height="12" rx="2" /><rect x="36" y="30" width="72" height="42" rx="3" /><polyline points="40,64 54,48 66,54 80,38 104,44" {...s} /></g>}
    {kind === 'pricing' && <g {...s}><rect x="10" y="18" width="28" height="52" rx="4" /><rect x="46" y="10" width="28" height="60" rx="4" {...f} /><rect x="82" y="18" width="28" height="52" rx="4" /><line x1="16" y1="32" x2="32" y2="32" /><line x1="52" y1="26" x2="68" y2="26" /><line x1="88" y1="32" x2="104" y2="32" /><line x1="16" y1="42" x2="32" y2="42" /><line x1="52" y1="38" x2="68" y2="38" /><line x1="88" y1="42" x2="104" y2="42" /></g>}
    {kind === 'profile' && <g {...s}><rect x="6" y="6" width="108" height="72" rx="6" /><circle cx="28" cy="28" r="9" /><line x1="48" y1="22" x2="86" y2="22" /><line x1="48" y1="32" x2="74" y2="32" /><rect x="14" y="48" width="40" height="8" rx="4" /><rect x="14" y="62" width="40" height="8" rx="4" /><rect x="66" y="48" width="40" height="22" rx="3" /></g>}
    {kind === 'checkout' && <g {...s}><rect x="6" y="6" width="108" height="72" rx="6" /><line x1="76" y1="6" x2="76" y2="78" /><line x1="14" y1="20" x2="68" y2="20" /><line x1="14" y1="32" x2="68" y2="32" /><line x1="14" y1="44" x2="44" y2="44" /><rect x="14" y="56" width="30" height="10" rx="5" {...f} stroke="none" /><line x1="84" y1="20" x2="106" y2="20" /><line x1="84" y1="32" x2="106" y2="32" /><line x1="84" y1="52" x2="106" y2="52" /></g>}
  </svg>;
}

export function PageSuggestions({ brandEnabled, brandName, busy, onStartPage }: { brandEnabled: boolean; brandName: string; busy: boolean; onStartPage: (id: string) => void }) {
  return <section className="home-inspiration" aria-label={tr("Page suggestions")}>
    <div className="home-section-heading"><h2>{tr("Pages from your design system")}</h2><span>{brandEnabled ? tr("Built on {0} — the page plus every use-case state, in one run.", [brandName || tr("your brand")]) : tr("Pick a page — it arrives with every use-case state, in one run.")}</span></div>
    <div className="inspiration-grid">{PAGE_SUGGESTIONS.map((s) => <button className="inspiration-card" key={s.id} disabled={busy} onClick={() => onStartPage(s.id)}>
      <div className="page-art" aria-hidden="true"><WireframeArt kind={s.art} /></div>
      <div className="inspiration-caption"><div><strong>{tr(s.titleEn)}</strong><span>{tr("{0} screens", [String(1 + s.cases.length)])}{tr(" · One run")}</span></div><ArrowUpRight size={16} /></div>
    </button>)}</div>
  </section>;
}
