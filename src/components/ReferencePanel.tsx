import {LocalizedFileInput} from './LocalizedFileInput';
import { tr } from '../lib/i18n';
import { useState } from 'react';
import { readReference } from '../lib/images';
export interface ReferenceImage { dataUrl: string; name: string; instruction: string }
export function ReferencePanel({ reference, onChange, onClose }: { reference: ReferenceImage | null; onChange: (value: ReferenceImage | null) => void; onClose: () => void }) {
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  return <div role="dialog" aria-label={tr("Design reference")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-xl bg-[var(--ui-surface)] p-5">
    <div className="flex justify-between"><h2 className="font-bold">{tr("Design reference")}</h2><button onClick={onClose}>{tr("Close")}</button></div>
    <p className="text-sm text-[var(--ui-muted)]">{tr("The sketch controls layout. This image guides visual style, colors and typography. It is sent separately to your selected vision model.")}</p>
    <LocalizedFileInput aria-label={tr("Reference image")} type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setPending(true); try { const dataUrl = await readReference(file); if (dataUrl.length > 1500000) throw new Error('Image is too detailed; choose a smaller image.'); onChange({ dataUrl, name: file.name, instruction: reference?.instruction || 'Use this visual style; keep the sketch layout and original content.' }); setError(''); } catch (err) { setError((err as Error).message); } finally { setPending(false); } }} />
    {pending && <p>{tr("Preparing image…")}</p>}
    {reference && <><img src={reference.dataUrl} alt={tr("Design style reference")} className="max-h-72 w-full rounded bg-[var(--ui-surface)] object-contain" /><p className="text-xs">{reference.name}</p><label className="block">{tr("What to borrow")}<input aria-label={tr("Reference instruction")} className="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2" value={reference.instruction} onChange={e => onChange({ ...reference, instruction: e.target.value })} /></label><button onClick={() => onChange(null)} className="text-[var(--ui-text)]">{tr("Remove reference")}</button></>}
    {error && <p role="alert" className="text-[var(--ui-text)]">{tr(error)}</p>}
  </section></div>;
}
