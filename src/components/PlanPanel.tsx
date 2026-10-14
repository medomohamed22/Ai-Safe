import { useState } from 'react';
import { load, save } from '../lib/storage';
import { parsePlan, planKey, planPrompt, type BuildPlan } from '../lib/plans';
import { extractCode } from '../lib/prompts';
import { sourceChecks } from '../lib/quality';
import { jsonAnswer, type ProductivityProps } from './ProductivityPanel';
export function PlanPanel(p: ProductivityProps) {
 const [plan, setPlan] = useState<BuildPlan | null>(() => load(planKey(p.scope), null));
 const [brief, setBrief] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const update = (value: BuildPlan) => { setPlan(value); save(planKey(p.scope), value); };
 const task = async (build: boolean) => {
  setBusy(true); setError('');
  try {
   if (build) {
    if (!plan?.approved) throw new Error('Approve the plan first.');
    const code = extractCode(await p.ask(`Implement this approved plan. Preserve existing functionality and API contracts.\n${planPrompt(plan)}\nCURRENT SOURCE:\n${p.code}`));
    const checks = sourceChecks(code); if (checks.some(c => !c.passed)) throw new Error(checks.find(c => !c.passed)!.detail);
    p.onAdopt(code);
   } else update(parsePlan(jsonAnswer(await p.ask(`Write an implementation plan for: ${brief}\nExisting source:\n${p.code}`, 'Return only JSON: {summary:string,requirements:[{text:string}]}. Each requirement must be specific and testable. Include user flows, responsive behavior, empty/loading/error states and API assumptions. No code.'))));
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 };
 return <div className="productivity-page"><h3>Plan before building</h3><p>Define acceptance requirements, edit and approve them before generation. Check a requirement as verified only after testing it. Approval is included in future normal generation requests for this screen.</p>
  <label>Project brief<textarea aria-label="Plan brief" value={brief} onChange={e => setBrief(e.target.value)} disabled={busy} /></label><button className="ui-button" disabled={busy || !brief.trim()} onClick={() => task(false)}>Create plan</button>
  {plan && <><label>Plan summary<textarea aria-label="Plan summary" value={plan.summary} disabled={busy} onChange={e => update({ ...plan, summary: e.target.value, approved: false })} /></label><ul>{plan.requirements.map((r, i) => <li key={r.id}><label>Requirement {i + 1}<input aria-label={`Requirement ${i + 1}`} value={r.text} disabled={busy} onChange={e => update({ ...plan, approved: false, requirements: plan.requirements.map(x => x.id === r.id ? { ...x, text: e.target.value, verified: false } : x) })} /></label><label className="check-option"><input type="checkbox" checked={r.verified} onChange={e => update({ ...plan, requirements: plan.requirements.map(x => x.id === r.id ? { ...x, verified: e.target.checked } : x) })} />Verified in a test</label></li>)}</ul><p aria-label="Plan progress">{plan.requirements.filter(r => r.verified).length}/{plan.requirements.length} verified · {plan.approved ? 'Approved' : 'Draft'}</p><div className="productivity-actions"><button className="ui-button" disabled={busy || plan.requirements.some(r => !r.text.trim())} onClick={() => update({ ...plan, approved: true })}>Approve plan</button><button className="ui-primary" disabled={busy || !plan.approved} onClick={() => task(true)}>{busy ? 'Working…' : 'Build approved plan'}</button></div></>}
  {error && <p role="alert">{error}</p>}
 </div>;
}
