import {LocalizedFileInput} from './LocalizedFileInput';
import { tr } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Trash2, Type } from 'lucide-react';
import type { Brand } from '../lib/brand';
import { readReference } from '../lib/images';
import { designSystemMarkdown, parseDesignSystem } from '../lib/designSystem';
import { addBrandAsset, detectTextLanguage, fontFamilyFromName, listBrandAssets, newAssetId, removeBrandAsset, validateAssetFile, type BrandAsset, type BrandAssetKind } from '../lib/brandAssets';
import { buildDesignSystem, type AskFn } from '../lib/designBuild';
import { Sparkles } from 'lucide-react';
import { luminance, paletteFromImage } from '../lib/palette';

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
}
function foreground(hex: string) {
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? '#171717' : '#ffffff';
}
export function BrandPanel({ brand, onChange, onClose, ask }: { brand: Brand; onChange: (value: Brand) => void; onClose: () => void; ask?: AskFn }) {
  const [error, setError] = useState('');
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildNote, setBuildNote] = useState('');
  const build = async () => {
    if (!ask || building) return;
    setBuilding(true); setBuildNote(''); setAssetError('');
    try {
      const built = await buildDesignSystem(assets, ask);
      onChange({ ...brand, ...built, enabled: true });
      setBuildNote('Design system built from your assets.');
    } catch (e) { setAssetError((e as Error).message); }
    setBuilding(false);
  };
  const [assetError, setAssetError] = useState('');
  const refreshAssets = () => { listBrandAssets().then(setAssets).catch((e) => setAssetError((e as Error).message)); };
  useEffect(refreshAssets, []);
  const addFiles = async (kind: BrandAssetKind, files: FileList | null) => {
    if (!files?.length) return;
    setAssetError('');
    let count = assets.length;
    try {
      for (const file of Array.from(files)) {
        const problem = validateAssetFile(kind, file);
        if (problem) throw new Error(problem);
        const base: BrandAsset = { id: newAssetId(), kind, name: file.name, mime: file.type, size: file.size, addedAt: Date.now() };
        if (kind === 'image') { base.dataUrl = await readReference(file, 1024); base.palette = await paletteFromImage(base.dataUrl); }
        else if (kind === 'logo') { base.dataUrl = file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml' ? await readAsDataUrl(file) : await readReference(file, 512); base.palette = await paletteFromImage(base.dataUrl); }
        else if (kind === 'doc') { base.text = (await file.text()).slice(0, 20000); base.lang = detectTextLanguage(base.text); }
        else { base.dataUrl = await readAsDataUrl(file); base.fontFamily = fontFamilyFromName(file.name); }
        await addBrandAsset(base, count);
        count++;
      }
      refreshAssets();
    } catch (e) { setAssetError((e as Error).message); refreshAssets(); }
  };
  const removeAsset = async (id: string) => { try { await removeBrandAsset(id); refreshAssets(); } catch (e) { setAssetError((e as Error).message); } };
  const paletteAsset = assets.find((a) => a.kind === 'logo' && a.palette?.length) || assets.find((a) => a.palette?.length);
  const applyPalette = () => {
    const colors = paletteAsset?.palette; if (!colors?.length) return;
    const byLight = [...colors].sort((a, b) => luminance(a) - luminance(b));
    onChange({ ...brand, enabled: true, primary: colors[0], secondary: colors[1] || brand.secondary, text: byLight[0], background: byLight[byLight.length - 1] });
  };
  const input = 'w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2';
  const exportDesign = () => { const url = URL.createObjectURL(new Blob([designSystemMarkdown(brand)], { type: 'text/markdown' })); const a = document.createElement('a'); a.href = url; a.download = 'DESIGN.md'; a.click(); URL.revokeObjectURL(url); };
  return <div role="dialog" aria-label={tr("Brand identity")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-xl bg-[var(--ui-surface)] p-5">
    <div className="flex justify-between"><h2 className="font-bold">{tr("Brand identity")}</h2><button onClick={onClose}>{tr("Close")}</button></div>
    <label className="flex gap-2"><input aria-label={tr("Apply saved brand")} type="checkbox" checked={brand.enabled} onChange={e => onChange({ ...brand, enabled: e.target.checked })} />{tr("Apply to future generation and updates")}</label>
    <label className="block">{tr("Brand name")}<input aria-label={tr("Brand name")} className={input} value={brand.name} onChange={e => onChange({ ...brand, name: e.target.value })} /></label>
    <div className="grid grid-cols-2 gap-3">{(['primary', 'secondary', 'background', 'text'] as const).map(key => <label key={key} className="capitalize">{tr(key)}<input aria-label={tr("Brand {0}", [tr(key)])} type="color" className="block h-10 w-full" value={brand[key]} onChange={e => onChange({ ...brand, [key]: e.target.value })} /></label>)}</div>
    <div className="grid grid-cols-3 gap-2">{(['surface', 'muted', 'success', 'warning', 'danger'] as const).map(key => <label key={key} className="capitalize text-xs">{tr(key)}<input aria-label={tr("Brand {0}", [tr(key)])} type="color" className="block h-8 w-full" value={brand[key]} onChange={e => onChange({ ...brand, [key]: e.target.value })} /></label>)}</div>
    <div className="grid grid-cols-3 gap-2"><label>{tr("Font")}<select aria-label={tr("Brand font")} className={input} value={brand.font} onChange={e => onChange({ ...brand, font: e.target.value })}>{[...new Set(['system-ui', 'Arial', 'Tahoma', 'Georgia', 'monospace', brand.font, ...assets.filter(a => a.kind === 'font' && a.fontFamily).map(a => a.fontFamily as string)])].map(font => <option key={font}>{font}</option>)}</select></label><label>{tr("Radius (px)")}<input aria-label={tr("Brand radius")} className={input} type="number" min="0" max="80" value={brand.radius} onChange={e => onChange({ ...brand, radius: Math.max(0, Math.min(80, Number(e.target.value))) })} /></label><label>{tr("Direction")}<select aria-label={tr("Brand direction")} className={input} value={brand.direction} onChange={e => onChange({ ...brand, direction: e.target.value as Brand['direction'] })}><option value="ltr">{tr("ltr")}</option><option value="rtl">{tr("rtl")}</option></select></label></div>
    <label>{tr("Logo")}<LocalizedFileInput aria-label={tr("Brand logo")} type="file" accept="image/png,image/jpeg,image/webp" className="block" onChange={async e => { try { const file = e.target.files?.[0]; if (file) { const logo = await readReference(file, 256); if (logo.length > 100000) throw new Error('Use a simpler/smaller logo (encoded limit 100 KB).'); onChange({ ...brand, logo }); setError(''); } } catch (err) { setError((err as Error).message); } }} /></label>
    {brand.logo && <div className="flex items-center gap-3"><img src={brand.logo} alt={tr("Saved brand logo")} className="h-16 w-16 object-contain" /><button onClick={() => onChange({ ...brand, logo: '' })}>{tr("Remove logo")}</button></div>}
    <div className="space-y-2 border-t border-[var(--ui-border)] pt-3">
      <h3 className="text-sm font-semibold">{tr("Design assets")}</h3>
      <p className="text-xs text-[var(--ui-muted)]">{tr("Assets are stored locally in this browser and are used when your design system is built and applied.")}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">{tr("Images")}<LocalizedFileInput aria-label={tr("Add images")} accept="image/png,image/jpeg,image/webp" multiple onChange={e => addFiles('image', e.target.files)} /></label>
        <label className="block text-xs">{tr("Logo files")}<LocalizedFileInput aria-label={tr("Add a logo file")} accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple onChange={e => addFiles('logo', e.target.files)} /></label>
        <label className="block text-xs">{tr("Documents (.md)")}<LocalizedFileInput aria-label={tr("Add a document")} accept=".md,.markdown,.txt,text/markdown,text/plain" multiple onChange={e => addFiles('doc', e.target.files)} /></label>
        <label className="block text-xs">{tr("Fonts")}<LocalizedFileInput aria-label={tr("Add a font")} accept=".woff2,.woff,.ttf,.otf" multiple onChange={e => addFiles('font', e.target.files)} /></label>
      </div>
      <p className="text-xs text-[var(--ui-muted)]">{tr("You are responsible for the license of fonts you upload.")}</p>
      {assets.length > 0 && <ul className="space-y-1" aria-label={tr("Design assets")}>{assets.map(a => <li key={a.id} className="flex items-center gap-2 rounded border border-[var(--ui-border)] p-1.5 text-xs">
        {a.dataUrl && a.kind !== 'font' ? <img src={a.dataUrl} alt="" className="h-8 w-8 rounded object-contain" /> : a.kind === 'doc' ? <FileText size={16} /> : a.kind === 'font' ? <Type size={16} /> : <ImageIcon size={16} />}
        <span className="min-w-0 flex-1 truncate"><bdi>{a.name}</bdi></span>
        {a.kind === 'doc' && a.lang && <span className="rounded bg-[var(--ui-bg)] px-1.5 py-0.5">{a.lang === 'ar' ? tr("Arabic") : a.lang === 'en' ? tr("English") : tr("Mixed")}</span>}
        {a.kind === 'font' && a.fontFamily && <span className="rounded bg-[var(--ui-bg)] px-1.5 py-0.5"><bdi>{a.fontFamily}</bdi></span>}
        <button className="ui-icon" aria-label={tr("Remove asset")} onClick={() => removeAsset(a.id)}><Trash2 size={14} /></button>
      </li>)}</ul>}
      {paletteAsset?.palette && <div className="space-y-1"><span className="text-xs">{tr("Extracted palette")}</span><div className="flex items-center gap-1.5">{paletteAsset.palette.map(c => <span key={c} title={c} className="h-6 w-6 rounded border border-[var(--ui-border)]" style={{ background: c }} />)}<button className="ui-button ms-2" onClick={applyPalette}>{tr("Use palette as brand colors")}</button></div></div>}
      {assetError && <p role="alert" className="text-xs">{tr(assetError)}</p>}
      <button className="ui-button ui-primary w-full" disabled={building || !assets.length} onClick={build}><Sparkles size={15} />{building ? tr("Building your design system…") : tr("Build my design system")}</button>
      {buildNote && <p className="text-xs" role="status">{tr(buildNote)}</p>}
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <button className="ui-button" onClick={exportDesign}>{tr("Export DESIGN.md")}</button>
      <label className="block">{tr("Import DESIGN.md")}<LocalizedFileInput aria-label={tr("Import DESIGN.md")} type="file" accept=".md,text/markdown,text/plain" className="block" onChange={async e => { try { const file = e.target.files?.[0]; if (!file) return; const parsed = parseDesignSystem(await file.text()); if (!Object.keys(parsed).length) throw new Error('No design tokens found in that file.'); onChange({ ...brand, ...parsed, enabled: true }); setError(''); } catch (err) { setError((err as Error).message); } }} /></label>
    </div>
        <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs">{tr("Display font")}<select aria-label={tr("Brand display font")} className={input} value={brand.displayFont} onChange={e => onChange({ ...brand, displayFont: e.target.value })}><option value="">{tr("Same as body font")}</option>{[...new Set(['system-ui', 'Arial', 'Tahoma', 'Georgia', 'monospace', brand.font, brand.displayFont, ...assets.filter(a => a.kind === 'font' && a.fontFamily).map(a => a.fontFamily as string)])].filter(Boolean).map(font => <option key={font}>{font}</option>)}</select></label>
      <label className="block text-xs">{tr("Content language")}<select aria-label={tr("Brand content language")} className={input} value={brand.language} onChange={e => onChange({ ...brand, language: e.target.value as Brand['language'] })}><option value="auto">{tr("From my files")}</option><option value="ar">{tr("Arabic")}</option><option value="en">{tr("English")}</option></select></label>
    </div>
    <label className="block text-xs">{tr("Voice and tone")}<input aria-label={tr("Brand voice")} className={input} value={brand.voice} onChange={e => onChange({ ...brand, voice: e.target.value })} placeholder={tr("e.g. Friendly and direct")} /></label>
    <div aria-label={tr("Brand sample")} dir={brand.direction} style={{ background: brand.background, color: brand.text, fontFamily: brand.font, borderRadius: brand.radius }} className="p-5"><strong>{brand.name || tr("Your brand")}</strong><div className="mt-3 flex gap-2"><span style={{ background: brand.primary, color: foreground(brand.primary), borderRadius: brand.radius }} className="px-4 py-2 text-[var(--ui-text)]">{tr("Primary")}</span><span style={{ background: brand.secondary, color: foreground(brand.secondary), borderRadius: brand.radius }} className="px-4 py-2 text-[var(--ui-text)]">{tr("Secondary")}</span></div></div>
    <div className="space-y-1"><span className="text-xs font-semibold">{tr("Brand board")}</span><div className="flex flex-wrap gap-1.5">{(['primary', 'secondary', 'background', 'surface', 'text', 'muted', 'success', 'warning', 'danger'] as const).map(key => <span key={key} className="flex items-center gap-1 rounded border border-[var(--ui-border)] px-1.5 py-1 text-[10px]"><span className="h-3.5 w-3.5 rounded-sm border border-[var(--ui-border)]" style={{ background: brand[key] }} />{tr(key)} <bdi>{brand[key]}</bdi></span>)}</div>
    <p dir={brand.direction} style={{ fontFamily: brand.displayFont || brand.font }} className="text-base font-bold">{brand.name || tr("Your brand")}</p>
    <p dir={brand.direction} style={{ fontFamily: brand.font }} className="text-xs text-[var(--ui-muted)]">{brand.voice || tr("Your brand voice will appear here.")}</p></div>
    <p className="text-xs text-[var(--ui-muted)]">{tr("Saved locally and included in generation requests. Existing code updates when you generate; applying the brand does not rewrite code by itself.")}</p>
    {error && <p role="alert" className="text-[var(--ui-text)]">{tr(error)}</p>}
  </section></div>;
}
