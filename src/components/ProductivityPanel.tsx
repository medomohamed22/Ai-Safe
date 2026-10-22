import { tr } from '../lib/i18n';
import { ServiceConnection } from './ServiceConnection';
import { serviceRequest } from '../lib/services';
import { ProjectsPanel } from './ProjectsPanel';
import { VideoPanel } from './VideoPanel';
import { FigmaPanel } from './FigmaPanel';
import { materializeAssets } from '../lib/designAssets';
import { ChangeReviewPanel } from './ChangeReviewPanel';
import { ImportPanel } from './ImportPanel';
import { UsagePanel } from './UsagePanel';
import { VisualComparePanel } from './VisualComparePanel';
import { LibraryPanel } from './LibraryPanel';
import { materializeLibrary } from '../lib/componentLibrary';
import { PlanPanel } from './PlanPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPreviewHtml } from '../lib/preview';
import { load } from '../lib/storage';
import { planKey, type BuildPlan } from '../lib/plans';
import { sourceChecks } from '../lib/quality';
import { parseScenarios, resultStatus, STATUS_LABELS, type Scenario, type ScenarioResult } from '../lib/interactionTests';
import type { BackendConfig } from '../lib/backend';
export interface ProductivityProps {
 reviewEnabled: boolean; onReviewEnabled: (enabled:boolean)=>void; review: {base:string;next:string;scope:string}|null; onAcceptReview: (next:string,base:string)=>void; onRejectReview: ()=>void; getSketch?: () => Promise<string | null>; model: string; reference?: string; scope: string; autoQuality: boolean; onAutoQuality: (enabled: boolean) => void; code: string; backend: BackendConfig; ask: (prompt: string, system?: string, images?: string[]) => Promise<string>; onAdopt: (code: string) => void; onClose: () => void;
}
export const jsonAnswer = (s: string) => JSON.parse(s.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '').trim());
export function ProductivityPanel(p: ProductivityProps) {
 const [section, setSection] = useState(p.review ? 'Review' : 'Quality');
 return <div role="dialog" aria-label={tr("Productivity studio")} className="productivity-overlay"><section className="productivity-shell"><header><div><span className="studio-eyebrow">{tr("BUILD WITH CONFIDENCE")}</span><h2>{tr("Productivity studio")}</h2></div><button data-dialog-close onClick={p.onClose} className="ui-button">{tr("Close")}</button></header><nav className="productivity-tabs" aria-label={tr("Productivity features")}>{['Quality','Plan','Library','Visual compare','Usage','Import project','Review','Figma','Video','Projects'].map(name => <button key={name} className="ui-button" aria-pressed={section === name} onClick={() => setSection(name)}>{tr(name)}</button>)}</nav>{section === 'Quality' ? <QualityPanel {...p} /> : section === 'Plan' ? <PlanPanel {...p} /> : section === 'Library' ? <LibraryPanel {...p} /> : section === 'Visual compare' ? <VisualComparePanel {...p} /> : section === 'Usage' ? <UsagePanel {...p} /> : section === 'Import project' ? <ImportPanel {...p} /> : section === 'Review' ? <ChangeReviewPanel {...p} /> : section === 'Figma' ? <FigmaPanel {...p} /> : section === 'Video' ? <VideoPanel {...p} /> : <ProjectsPanel />}<ServiceConnection /></section></div>;
}
function QualityPanel(p: ProductivityProps) {
 const [candidate, setCandidate] = useState(p.code);
 // Build-service health (P1-06): probe once when the panel opens so the
 // user learns early whether the bundle check can run on this deployment.
 const [serviceState, setServiceState] = useState<'checking' | 'available' | 'unavailable'>('checking');
 useEffect(() => { let live = true; serviceRequest('/api/quality', { code: 'export default function App(){return null}' }).then(async r => { const b = await r.json().catch(() => null); if (live) setServiceState(r.ok && b && typeof b.passed === 'boolean' ? 'available' : 'unavailable'); }).catch(() => { if (live) setServiceState('unavailable'); }); return () => { live = false; }; }, []);
 const [goals, setGoals] = useState(() => { const plan = load<BuildPlan | null>(planKey(p.scope),null); return plan?.approved ? plan.requirements.map(r => r.text).join('\n') : ''; });
 const [scenarios, setScenarios] = useState<Scenario[]>([]);
 const [rows, setRows] = useState<ScenarioResult[]>([]);
 const [busy, setBusy] = useState(false);
 const [repair, setRepair] = useState(false);
 const [error, setError] = useState('');
 const [frameJob, setFrameJob] = useState<{ token: string; code: string; width: number; scenarios: Scenario[] } | null>(null);
 const frame = useRef<HTMLIFrameElement>(null);
 const waiting = useRef<((r: ScenarioResult[]) => void) | null>(null);
 const active = useRef(true);
 useEffect(() => { active.current = true; return () => { active.current = false; waiting.current?.([{ name: 'Cancelled', passed: false, detail: 'Panel closed' }]); }; }, []);
 const html = useMemo(() => frameJob ? buildPreviewHtml(frameJob.code, { token: frameJob.token, tests: true }, { ...p.backend, mode: 'demo' }) : '', [frameJob, p.backend]);
 useEffect(() => {
  if (!frameJob) return;
  let dispatched = false;
  const done = (results: ScenarioResult[]) => { const resolve = waiting.current; waiting.current = null; resolve?.(results); };
  const timer = setTimeout(() => done([{ name: 'Runtime', passed: false, detail: 'Preview timed out or a required CDN could not load.' }]), 45000);
  const handler = (e: MessageEvent) => {
   if (e.source !== frame.current?.contentWindow) return;
   if (e.data?.source === 's2ui-preview' && e.data.type === 'error') done([{ name: 'Runtime', passed: false, detail: String(e.data.message) }]);
   if (e.data?.source === 's2ui-preview' && e.data.type === 'ready' && !dispatched) { dispatched = true; frame.current?.contentWindow?.postMessage({ type: 'quality-check', token: frameJob.token, scenarios: frameJob.scenarios }, '*'); }
   if (e.data?.source === 's2ui-quality' && e.data.token === frameJob.token && Array.isArray(e.data.results)) done(e.data.results);
  };
  window.addEventListener('message', handler);
  return () => { clearTimeout(timer); window.removeEventListener('message', handler); };
 }, [frameJob]);
 const check = async (code: string, tests: Scenario[]) => {
  const result = sourceChecks(code);
  if (result.some(r => !r.passed)) return result;
  try {
   const response = await serviceRequest('/api/quality', { code: materializeAssets(materializeLibrary(code)) });
   const bundle = await response.json().catch(() => null);
   if (response.ok && bundle && typeof bundle.passed === 'boolean') result.push({ name: 'Production JavaScript bundle', passed: bundle.passed, status: bundle.passed ? 'passed' : 'failed', detail: bundle.detail || bundle.error || 'Bundle compiled' });
   else result.push({ name: 'Production JavaScript bundle', passed: false, status: 'blocked', detail: 'Build check service unavailable on this deployment, so the bundle was not verified. This is an environment limit, not a code failure. See the README section on running the quality build service.' });
  } catch { result.push({ name: 'Production JavaScript bundle', passed: false, status: 'blocked', detail: 'Build check service unavailable on this deployment, so the bundle was not verified. This is an environment limit, not a code failure. See the README section on running the quality build service.' }); }
  if (!tests.length) result.push({ name: 'Acceptance scenarios', passed: false, status: 'untested', detail: 'No acceptance scenarios were provided or generated, so feature behavior is unverified. Add acceptance goals above to generate scenarios.' });
  for (const width of [390, 820, 1440]) {
   if (!active.current) break;
   const runtime = await new Promise<ScenarioResult[]>(resolve => { waiting.current = resolve; setFrameJob({ token: crypto.randomUUID(), code, width, scenarios: tests }); });
   result.push(...runtime.map(r => ({ ...r, name: `${width}px · ${r.name}` })));
   if (runtime.some(r => r.name === 'Runtime' && !r.passed)) break;
  }
  return result;
 };
 const run = async () => {
  setBusy(true); setRows([]); setError('');
  try {
   let tests = scenarios;
   if (goals.trim()) {
    tests = parseScenarios(JSON.stringify(jsonAnswer(await p.ask(`Create explicit interaction test scenarios for these acceptance goals: ${goals}\nSOURCE:\n${candidate}`, 'Return only a JSON array of 1–10 {name,steps:[{action,selector,value?}]}. Actions: exists,click,fill,expectText. Max 50 total steps. Each scenario needs a meaningful assertion. Selectors must be standard CSS present in the source, or the explicit text form tag:has-text(\"Visible text\") which the runner resolves by visible text; no other Playwright syntax. The final assertion of each scenario must verify the observable outcome of the goal — prefer expectText with the exact expected visible text (the title of the added item, a success message, an empty-state message) over merely asserting a container exists. No network actions.'))));
    if (!active.current) return;
    setScenarios(tests);
   }
   let current = candidate;
   for (let attempt = 0; attempt <= (repair ? 2 : 0); attempt++) {
    const results = await check(current, tests);
    if (!active.current) return;
    setRows(results);
    const failures = results.filter(r => resultStatus(r) === 'failed');
    if (!failures.length || attempt === (repair ? 2 : 0)) break;
    const answer = await p.ask(`Repair only these measured failures, preserve all other behavior. Return a complete JSX file.\nFAILURES:\n${JSON.stringify(failures)}\nSOURCE:\n${current}`);
    const next = answer.replace(/^\s*```(?:jsx|tsx|javascript)?\s*/, '').replace(/\s*```\s*$/, '').trim();
    if (!active.current) return;
    if (next === current) { setError('Repair returned unchanged source; stopped to avoid repeated requests.'); break; }
    current = next; setCandidate(next);
   }
  } catch (e) { if (active.current) setError((e as Error).message); }
  finally { if (active.current) setBusy(false); }
 };
 const started = useRef(false);
 useEffect(() => { if (p.autoQuality && !started.current) { started.current = true; run(); } }, []);
 return <div className="productivity-page"><h3>{tr("Automatic quality checks")}</h3><p>{tr("Checks a production JavaScript bundle, rendering, overflow at three widths, basic labels and your acceptance scenarios in a network-blocked demo preview. CSS, full accessibility, TypeScript types and live APIs need separate verification.")}</p><p role="status">{serviceState === 'checking' ? tr("Checking the build service…") : serviceState === 'available' ? tr("Build service is available — the production bundle check will run.") : tr("Build service is not available on this deployment — the bundle check will be marked blocked, not failed. Connect a service below or see the README.")}</p>
  <label className="check-option"><input type="checkbox" checked={p.autoQuality} onChange={e => p.onAutoQuality(e.target.checked)} />{tr("Open and run checks after generation")}</label>
  <label>{tr("Acceptance goals")}<textarea aria-label={tr("Quality acceptance goals")} placeholder={tr("Example: adding a task shows it in the list; deleting it removes it.")} value={goals} onChange={e => setGoals(e.target.value)} disabled={busy} /></label>
  <label className="check-option"><input type="checkbox" checked={repair} onChange={e => setRepair(e.target.checked)} disabled={busy} />{tr("Try up to two AI repairs. Original stays unchanged until adoption.")}</label>
  <div className="productivity-actions"><button className="ui-primary" disabled={busy || !candidate} onClick={run}>{busy ? tr("Checking…") : tr("Run automatic checks")}</button>{candidate !== p.code && <button className="ui-button" disabled={busy || !rows.length || rows.some(r => resultStatus(r) === 'failed')} onClick={() => { try { p.onAdopt(candidate); } catch (e) { setError((e as Error).message); } }}>{tr("Adopt checked repair")}</button>}</div>
  {error && <p role="alert">{tr(error)}</p>}{rows.length > 0 && <p className="quality-summary">{(["passed", "failed", "setup-error", "blocked", "untested"] as const).map(st => { const n = rows.filter(r => resultStatus(r) === st).length; return n ? <span key={st}>{tr(STATUS_LABELS[st])} {n}</span> : null; }).filter(Boolean)}</p>}<ul aria-label={tr("Quality results")}>{rows.map((r, i) => <li key={i}><b>{tr(STATUS_LABELS[resultStatus(r)])} — {tr(r.name)}</b><span>{tr(r.detail)}</span></li>)}</ul>
  {frameJob && <div className="quality-frame-scroll"><iframe ref={frame} key={frameJob.token} title={tr("Quality preview")} srcDoc={html} sandbox="allow-scripts" style={{ width: frameJob.width, height: 520 }} /></div>}
 </div>;
}
