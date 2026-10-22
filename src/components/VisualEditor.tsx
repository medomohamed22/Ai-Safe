import { tr } from '../lib/i18n';
import { useState } from 'react';
import { applyElementEdit, describeElement, type ElementEdit } from '../lib/visualEdit';

export function VisualEditor({ code, id, disabled, locks, onToggleLock, onApply, onRequest, onAgentRequest, onClose }: {
  code: string; id: number; disabled: boolean;
  locks: string[]; onToggleLock: (snippet: string) => void;
  onApply: (code: string) => void; onRequest: (instruction: string) => void; onAgentRequest?: (instruction: string, id: number) => void; onClose: () => void;
}) {
  const info = describeElement(code, id);
  const [text, setText] = useState(info.text);
  const [edit, setEdit] = useState<ElementEdit>({});
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState('');
  const input = 'w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-1.5 text-[var(--ui-text)]';
  const apply = () => {
    try {
      const patch = { ...edit, ...(info.editableText && text !== info.text ? { text } : {}) };
      if (!Object.keys(patch).length) return;
      onApply(applyElementEdit(code, id, patch));
    } catch (e) { setError(String((e as Error).message)); }
  };
  return <section aria-label={tr("Element editor")} className="element-inspector">
    <div className="inspector-heading"><strong>{tr("Edit <")}{info.tag}&gt;</strong><button onClick={onClose} aria-label={tr("Close element editor")}>✕</button></div>
    <p className="mb-2 text-[var(--ui-muted)]">{tr("Repeated items share the same source: changes apply to every instance.")}</p>
    <p className="mb-2 text-[var(--ui-muted)]">{tr("Drag the element in the preview to reorder it, or drag its handles to resize it.")}</p>
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
      <button className="rounded border border-[var(--ui-border)] px-3 py-1 text-[var(--ui-text)]" onClick={() => { onToggleLock(info.snippet); setError(''); }}>{locks.includes(info.snippet) ? tr("Unlock element") : tr("Lock element")}</button>
      {info.editableText ? <label className="block">{tr("Text")}<input aria-label={tr("Element text")} className={input} value={text} onChange={(e) => setText(e.target.value)} /></label> : <p className="text-[var(--ui-text)]">{tr("Nested or dynamic text is protected. Use the AI instruction below.")}</p>}
      <div className="grid grid-cols-2 gap-2">
        <label>{tr("Text color")}<input aria-label={tr("Text color")} type="color" value={edit.color ?? '#000000'} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="block h-8 w-full" /></label>
        <label>{tr("Background")}<input aria-label={tr("Background color")} type="color" value={edit.backgroundColor ?? '#ffffff'} onChange={(e) => setEdit({ ...edit, backgroundColor: e.target.value })} className="block h-8 w-full" /></label>
        <label>{tr("Padding (px)")}<input aria-label={tr("Padding")} type="number" min="0" max="200" placeholder={tr("Unchanged")} className={input} value={edit.padding ?? ''} onChange={(e) => setEdit({ ...edit, padding: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <label>{tr("Radius (px)")}<input aria-label={tr("Border radius")} type="number" min="0" max="200" placeholder={tr("Unchanged")} className={input} value={edit.borderRadius ?? ''} onChange={(e) => setEdit({ ...edit, borderRadius: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <label>{tr("Width (px)")}<input aria-label={tr("Width")} type="number" min="0" max="2000" placeholder={tr("Unchanged")} className={input} value={edit.width ?? ''} onChange={(e) => setEdit({ ...edit, width: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <label>{tr("Height (px)")}<input aria-label={tr("Height")} type="number" min="0" max="2000" placeholder={tr("Unchanged")} className={input} value={edit.height ?? ''} onChange={(e) => setEdit({ ...edit, height: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
      </div>
      <button onClick={apply} className="rounded ui-primary px-3 py-2 font-medium">{tr("Apply to code")}</button>
      <div className="space-y-1.5">
        <div className="flex gap-2"><input aria-label={tr("Selected element instruction")} placeholder={tr("Describe a change to this element…")} className={input} value={instruction} onChange={(e) => setInstruction(e.target.value)} /><button disabled={!instruction.trim()} className="shrink-0 rounded ui-primary px-2 disabled:opacity-40" onClick={() => { if (onAgentRequest) onAgentRequest(instruction.trim(), id); else onRequest(`Edit only the selected JSX element (and supporting logic if required). Preserve the rest of the UI and its behavior. Selected source:\n\n${info.snippet}\n\nRequested change: ${instruction.trim()}`); }}>{tr("Edit element only")}</button></div>
        <p className="text-xs text-[var(--ui-muted)]">{tr("An agent reads this element and its context, edits only it, and verifies the result — the rest of the page stays exactly as it is.")}</p>
        <button disabled={!instruction.trim()} className="text-xs text-[var(--ui-text)] underline disabled:opacity-40" onClick={() => onRequest(`Edit only the selected JSX element (and supporting logic if required). Preserve the rest of the UI and its behavior. Selected source:\n\n${info.snippet}\n\nRequested change: ${instruction.trim()}`)}>{tr("Regenerate the whole page instead")}</button>
      </div>
    </fieldset>
    {error && <p role="alert" className="mt-2 text-[var(--ui-text)]">{tr(error)}</p>}
  </section>;
}
