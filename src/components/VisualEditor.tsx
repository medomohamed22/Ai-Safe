import { tr } from '../lib/i18n';
import { useState } from 'react';
import { applyElementEdit, describeElement, type ElementEdit } from '../lib/visualEdit';
import { elementA11yChecks } from '../lib/elementA11y';
import { AlertTriangle, Check, Minus } from 'lucide-react';

export function VisualEditor({ code, id, ids, disabled, locks, onToggleLock, onApply, onRequest, onAgentRequest, onSaveToLibrary, onClose }: {
  code: string; id: number; ids: number[]; disabled: boolean;
  locks: string[]; onToggleLock: (snippet: string) => void;
  onApply: (code: string) => void; onRequest: (instruction: string) => void; onAgentRequest?: (instruction: string, ids: number[], mode: 'edit' | 'insert') => void; onSaveToLibrary?: (snippet: string, tag: string) => string; onClose: () => void;
}) {
  const info = describeElement(code, id);
  const [text, setText] = useState(info.text);
  const [edit, setEdit] = useState<ElementEdit>({});
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const checks = elementA11yChecks(info.snippet, info.tag);
  const [agentMode, setAgentMode] = useState<'edit' | 'insert'>('edit');
  const multi = ids.length > 1;
  const selfClosing = /\/>\s*$/.test(info.snippet.trim());
  const tags = multi ? ids.map((x) => { try { return describeElement(code, x).tag; } catch { return '?'; } }) : [];
  const input = 'w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-1.5 text-[var(--ui-text)]';
  const apply = () => {
    try {
      const patch = { ...edit, ...(info.editableText && text !== info.text ? { text } : {}) };
      if (!Object.keys(patch).length) return;
      onApply(applyElementEdit(code, id, patch));
    } catch (e) { setError(String((e as Error).message)); }
  };
  return <section aria-label={tr("Element editor")} className="element-inspector">
    <div className="inspector-heading">{multi ? <strong>{tr('{0} elements selected', [ids.length])}</strong> : <strong>{tr("Edit <")}{info.tag}&gt;</strong>}<button onClick={onClose} aria-label={tr("Close element editor")}>✕</button></div>
    <p className="mb-2 text-[var(--ui-muted)]">{tr("Repeated items share the same source: changes apply to every instance.")}</p>
    <p className="mb-2 text-[var(--ui-muted)]">{tr("Drag the element in the preview to reorder it, or drag its handles to resize it.")}</p>{multi && <p className="mb-2 text-[var(--ui-muted)]">{tags.map((t) => `<${t}>`).join('  ')}</p>}
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
      {!multi && <><div className="flex flex-wrap gap-2"><button className="rounded border border-[var(--ui-border)] px-3 py-1 text-[var(--ui-text)]" onClick={() => { onToggleLock(info.snippet); setError(''); }}>{locks.includes(info.snippet) ? tr("Unlock element") : tr("Lock element")}</button>{onSaveToLibrary && <button className="rounded border border-[var(--ui-border)] px-3 py-1 text-[var(--ui-text)]" onClick={() => { try { const name = onSaveToLibrary(info.snippet, info.tag); setSavedNote(tr('Saved to the library as {0}', [name])); setError(''); } catch (e) { setError((e as Error).message); } }}>{tr("Save to library")}</button>}</div>{savedNote && <p className="text-xs text-[var(--ui-muted)]">{savedNote}</p>}
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
      <div className="space-y-1 border-t border-[var(--ui-border)] pt-2">
        <p className="text-xs font-medium text-[var(--ui-text)]">{tr("Checks")}</p>
        {checks.map(c => <div key={c.id} className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ui-muted)]">{c.status === 'pass' ? <Check size={13} /> : c.status === 'warn' ? <AlertTriangle size={13} /> : <Minus size={13} />}<span><b className="text-[var(--ui-text)]">{tr(c.label)}:</b> {tr(c.detailKey, c.detailArgs)}</span>{c.fix && <button className="text-[var(--ui-text)] underline" onClick={() => { try { onApply(applyElementEdit(code, id, c.fix!)); setError(''); } catch (e) { setError((e as Error).message); } }}>{tr(c.fixLabel!)}</button>}{c.agentHint && <button className="text-[var(--ui-text)] underline" onClick={() => setInstruction(c.agentHint!)}>{tr("Ask the agent")}</button>}</div>)}
      </div></>}
      <div className="space-y-1.5">
        {!multi && !selfClosing && onAgentRequest && <div className="flex gap-1" role="group" aria-label={tr("Agent mode")}>
          <button aria-pressed={agentMode === 'edit'} className={`rounded border px-2 py-1 text-xs ${agentMode === 'edit' ? 'ui-primary' : 'border-[var(--ui-border)] text-[var(--ui-text)]'}`} onClick={() => setAgentMode('edit')}>{tr("Edit this element")}</button>
          <button aria-pressed={agentMode === 'insert'} className={`rounded border px-2 py-1 text-xs ${agentMode === 'insert' ? 'ui-primary' : 'border-[var(--ui-border)] text-[var(--ui-text)]'}`} onClick={() => setAgentMode('insert')}>{tr("Add inside it")}</button>
        </div>}
        <div className="flex gap-2"><input aria-label={tr("Selected element instruction")} placeholder={multi ? tr("Describe a change for all of them…") : agentMode === 'insert' ? tr("Describe the element to add inside…") : tr("Describe a change to this element…")} className={input} value={instruction} onChange={(e) => setInstruction(e.target.value)} /><button disabled={!instruction.trim()} className="shrink-0 rounded ui-primary px-2 disabled:opacity-40" onClick={() => { if (onAgentRequest) onAgentRequest(instruction.trim(), ids, multi ? 'edit' : agentMode); else onRequest(`Edit only the selected JSX element (and supporting logic if required). Preserve the rest of the UI and its behavior. Selected source:\n\n${info.snippet}\n\nRequested change: ${instruction.trim()}`); }}>{multi ? tr('Edit {0} elements only', [ids.length]) : agentMode === 'insert' ? tr("Add inside this element") : tr("Edit element only")}</button></div>
        <p className="text-xs text-[var(--ui-muted)]">{multi ? tr("An agent applies the same instruction to each selected element and verifies the result — the rest of the page stays exactly as it is.") : agentMode === 'insert' ? tr("An agent reads this container and adds only the new element inside it — everything else stays exactly as it is.") : tr("An agent reads this element and its context, edits only it, and verifies the result — the rest of the page stays exactly as it is.")}</p>
        {!multi && agentMode === 'edit' && <button disabled={!instruction.trim()} className="text-xs text-[var(--ui-text)] underline disabled:opacity-40" onClick={() => onRequest(`Edit only the selected JSX element (and supporting logic if required). Preserve the rest of the UI and its behavior. Selected source:\n\n${info.snippet}\n\nRequested change: ${instruction.trim()}`)}>{tr("Regenerate the whole page instead")}</button>}
      </div>
    </fieldset>
    {error && <p role="alert" className="mt-2 text-[var(--ui-text)]">{tr(error)}</p>}
  </section>;
}
