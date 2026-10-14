import { useState } from 'react';
import { readReference } from '../lib/images';
export interface ReferenceImage { dataUrl: string; name: string; instruction: string }
export function ReferencePanel({ reference, onChange, onClose }: { reference: ReferenceImage | null; onChange: (value: ReferenceImage | null) => void; onClose: () => void }) {
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  return <div role="dialog" aria-label="Design reference" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-xl bg-slate-900 p-5">
    <div className="flex justify-between"><h2 className="font-bold">Design reference</h2><button onClick={onClose}>Close</button></div>
    <p className="text-sm text-slate-400">The sketch controls layout. This image guides visual style, colors and typography. It is sent separately to your selected vision model.</p>
    <input aria-label="Reference image" type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setPending(true); try { const dataUrl = await readReference(file); if (dataUrl.length > 1500000) throw new Error('Image is too detailed; choose a smaller image.'); onChange({ dataUrl, name: file.name, instruction: reference?.instruction || 'Use this visual style; keep the sketch layout and original content.' }); setError(''); } catch (err) { setError((err as Error).message); } finally { setPending(false); } }} />
    {pending && <p>Preparing image…</p>}
    {reference && <><img src={reference.dataUrl} alt="Design style reference" className="max-h-72 w-full rounded bg-white object-contain" /><p className="text-xs">{reference.name}</p><label className="block">What to borrow<input aria-label="Reference instruction" className="w-full rounded border border-slate-600 bg-slate-950 p-2" value={reference.instruction} onChange={e => onChange({ ...reference, instruction: e.target.value })} /></label><button onClick={() => onChange(null)} className="text-red-300">Remove reference</button></>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </section></div>;
}
