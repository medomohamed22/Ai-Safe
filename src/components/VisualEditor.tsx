import { useState } from 'react';
import { applyElementEdit, describeElement, type ElementEdit } from '../lib/visualEdit';

export function VisualEditor({ code, id, disabled, locks, onToggleLock, onApply, onRequest, onClose }: {
  code: string; id: number; disabled: boolean;
  locks: string[]; onToggleLock: (snippet: string) => void;
  onApply: (code: string) => void; onRequest: (instruction: string) => void; onClose: () => void;
}) {
  const info = describeElement(code, id);
  const [text, setText] = useState(info.text);
  const [edit, setEdit] = useState<ElementEdit>({});
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState('');
  const input = 'w-full rounded border border-slate-600 bg-slate-950 p-1.5 text-slate-100';
  const apply = () => {
    try {
      const patch = { ...edit, ...(info.editableText && text !== info.text ? { text } : {}) };
      if (!Object.keys(patch).length) return;
      onApply(applyElementEdit(code, id, patch));
    } catch (e) { setError(String((e as Error).message)); }
  };
  return <section aria-label="Element editor" className="min-h-0 max-h-40 overflow-auto sm:max-h-72 border-b border-slate-700 bg-slate-900 p-3 text-xs">
    <div className="mb-2 flex items-center justify-between"><strong>Edit &lt;{info.tag}&gt;</strong><button onClick={onClose} aria-label="Close element editor">✕</button></div>
    <p className="mb-2 text-slate-400">Repeated items share the same source: changes apply to every instance.</p>
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
      <button className="rounded border border-amber-500 px-3 py-1 text-amber-200" onClick={() => { onToggleLock(info.snippet); setError(''); }}>{locks.includes(info.snippet) ? 'Unlock element' : 'Lock element'}</button>
      {info.editableText ? <label className="block">Text<input aria-label="Element text" className={input} value={text} onChange={(e) => setText(e.target.value)} /></label> : <p className="text-amber-200">Nested or dynamic text is protected. Use the AI instruction below.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label>Text color<input aria-label="Text color" type="color" value={edit.color ?? '#000000'} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="block h-8 w-full" /></label>
        <label>Background<input aria-label="Background color" type="color" value={edit.backgroundColor ?? '#ffffff'} onChange={(e) => setEdit({ ...edit, backgroundColor: e.target.value })} className="block h-8 w-full" /></label>
        <label>Padding (px)<input aria-label="Padding" type="number" min="0" max="200" placeholder="Unchanged" className={input} value={edit.padding ?? ''} onChange={(e) => setEdit({ ...edit, padding: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <label>Radius (px)<input aria-label="Border radius" type="number" min="0" max="200" placeholder="Unchanged" className={input} value={edit.borderRadius ?? ''} onChange={(e) => setEdit({ ...edit, borderRadius: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
      </div>
      <button onClick={apply} className="rounded bg-indigo-600 px-3 py-2 font-medium">Apply to code</button>
      <div className="flex gap-2"><input aria-label="Selected element instruction" placeholder="Describe a change to this element…" className={input} value={instruction} onChange={(e) => setInstruction(e.target.value)} /><button disabled={!instruction.trim()} className="shrink-0 rounded border border-indigo-500 px-2 disabled:opacity-40" onClick={() => onRequest(`Edit only the selected JSX element (and supporting logic if required). Preserve the rest of the UI and its behavior. Selected source:\n\n${info.snippet}\n\nRequested change: ${instruction.trim()}`)}>Edit with AI</button></div>
    </fieldset>
    {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
  </section>;
}
