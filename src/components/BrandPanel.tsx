import {LocalizedFileInput} from './LocalizedFileInput';
import { tr } from '../lib/i18n';
import { useState } from 'react';
import type { Brand } from '../lib/brand';
import { readReference } from '../lib/images';
import { designSystemMarkdown, parseDesignSystem } from '../lib/designSystem';
function foreground(hex: string) {
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? '#171717' : '#ffffff';
}
export function BrandPanel({ brand, onChange, onClose }: { brand: Brand; onChange: (value: Brand) => void; onClose: () => void }) {
  const [error, setError] = useState('');
  const input = 'w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2';
  const exportDesign = () => { const url = URL.createObjectURL(new Blob([designSystemMarkdown(brand)], { type: 'text/markdown' })); const a = document.createElement('a'); a.href = url; a.download = 'DESIGN.md'; a.click(); URL.revokeObjectURL(url); };
  return <div role="dialog" aria-label={tr("Brand identity")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-xl bg-[var(--ui-surface)] p-5">
    <div className="flex justify-between"><h2 className="font-bold">{tr("Brand identity")}</h2><button onClick={onClose}>{tr("Close")}</button></div>
    <label className="flex gap-2"><input aria-label={tr("Apply saved brand")} type="checkbox" checked={brand.enabled} onChange={e => onChange({ ...brand, enabled: e.target.checked })} />{tr("Apply to future generation and updates")}</label>
    <label className="block">{tr("Brand name")}<input aria-label={tr("Brand name")} className={input} value={brand.name} onChange={e => onChange({ ...brand, name: e.target.value })} /></label>
    <div className="grid grid-cols-2 gap-3">{(['primary', 'secondary', 'background', 'text'] as const).map(key => <label key={key} className="capitalize">{tr(key)}<input aria-label={tr("Brand {0}", [tr(key)])} type="color" className="block h-10 w-full" value={brand[key]} onChange={e => onChange({ ...brand, [key]: e.target.value })} /></label>)}</div>
    <div className="grid grid-cols-3 gap-2"><label>{tr("Font")}<select aria-label={tr("Brand font")} className={input} value={brand.font} onChange={e => onChange({ ...brand, font: e.target.value })}>{['system-ui', 'Arial', 'Tahoma', 'Georgia', 'monospace'].map(font => <option key={font}>{font}</option>)}</select></label><label>{tr("Radius (px)")}<input aria-label={tr("Brand radius")} className={input} type="number" min="0" max="80" value={brand.radius} onChange={e => onChange({ ...brand, radius: Math.max(0, Math.min(80, Number(e.target.value))) })} /></label><label>{tr("Direction")}<select aria-label={tr("Brand direction")} className={input} value={brand.direction} onChange={e => onChange({ ...brand, direction: e.target.value as Brand['direction'] })}><option value="ltr">{tr("ltr")}</option><option value="rtl">{tr("rtl")}</option></select></label></div>
    <label>{tr("Logo")}<LocalizedFileInput aria-label={tr("Brand logo")} type="file" accept="image/png,image/jpeg,image/webp" className="block" onChange={async e => { try { const file = e.target.files?.[0]; if (file) { const logo = await readReference(file, 256); if (logo.length > 100000) throw new Error('Use a simpler/smaller logo (encoded limit 100 KB).'); onChange({ ...brand, logo }); setError(''); } } catch (err) { setError((err as Error).message); } }} /></label>
    {brand.logo && <div className="flex items-center gap-3"><img src={brand.logo} alt={tr("Saved brand logo")} className="h-16 w-16 object-contain" /><button onClick={() => onChange({ ...brand, logo: '' })}>{tr("Remove logo")}</button></div>}
    <div className="flex flex-wrap items-end gap-3">
      <button className="ui-button" onClick={exportDesign}>{tr("Export DESIGN.md")}</button>
      <label className="block">{tr("Import DESIGN.md")}<LocalizedFileInput aria-label={tr("Import DESIGN.md")} type="file" accept=".md,text/markdown,text/plain" className="block" onChange={async e => { try { const file = e.target.files?.[0]; if (!file) return; const parsed = parseDesignSystem(await file.text()); if (!Object.keys(parsed).length) throw new Error('No design tokens found in that file.'); onChange({ ...brand, ...parsed, enabled: true }); setError(''); } catch (err) { setError((err as Error).message); } }} /></label>
    </div>
    <div aria-label={tr("Brand sample")} dir={brand.direction} style={{ background: brand.background, color: brand.text, fontFamily: brand.font, borderRadius: brand.radius }} className="p-5"><strong>{brand.name || tr("Your brand")}</strong><div className="mt-3 flex gap-2"><span style={{ background: brand.primary, color: foreground(brand.primary), borderRadius: brand.radius }} className="px-4 py-2 text-[var(--ui-text)]">{tr("Primary")}</span><span style={{ background: brand.secondary, color: foreground(brand.secondary), borderRadius: brand.radius }} className="px-4 py-2 text-[var(--ui-text)]">{tr("Secondary")}</span></div></div>
    <p className="text-xs text-[var(--ui-muted)]">{tr("Saved locally and included in generation requests. Existing code updates when you generate; applying the brand does not rewrite code by itself.")}</p>
    {error && <p role="alert" className="text-[var(--ui-text)]">{tr(error)}</p>}
  </section></div>;
}
