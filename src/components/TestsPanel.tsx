import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPreviewHtml } from '../lib/preview';
import { load, save } from '../lib/storage';
import { parseScenarios, type ScenarioResult } from '../lib/interactionTests';
import type { BackendConfig } from '../lib/backend';

const sample = JSON.stringify([{ name: 'Page renders', steps: [{ action: 'exists', selector: '#root > *' }] }], null, 2);
export function TestsPanel({ code, backend, onClose }: { code: string; backend: BackendConfig; onClose: () => void }) {
  const [text, setText] = useState(() => load('s2ui.tests.v1', sample));
  const [run, setRun] = useState<{ token: string; scenarios: ReturnType<typeof parseScenarios> } | null>(null);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => run ? buildPreviewHtml(code, { token: run.token, tests: true }, { ...backend, mode: 'demo' }) : '', [run, code, backend]);
  useEffect(() => {
    if (!run) return;
    const timer = setTimeout(() => { setPending(false); setError('Test run timed out. Check preview runtime errors or CDN connectivity.'); }, 145000);
    const handle = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.source === 's2ui-preview' && e.data.type === 'ready') frame.current?.contentWindow?.postMessage({ type: 'run-tests', token: run.token, scenarios: run.scenarios }, '*');
      if (e.data?.source === 's2ui-preview' && e.data.type === 'error') { clearTimeout(timer); setError(e.data.message); setPending(false); }
      if (e.data?.source === 's2ui-tests' && e.data.token === run.token) { clearTimeout(timer); setResults(e.data.results); setPending(false); }
    };
    window.addEventListener('message', handle);
    return () => { clearTimeout(timer); window.removeEventListener('message', handle); };
  }, [run]);
  return <div role="dialog" aria-label="Interaction tests" className="fixed inset-0 z-50 overflow-auto bg-slate-950 p-5 text-slate-200"><div className="mx-auto max-w-4xl space-y-3">
    <div className="flex justify-between"><h2 className="font-bold">Interaction tests</h2><button onClick={onClose}>Close</button></div>
    <p className="text-sm text-slate-400">Runs your explicit scenarios in a fresh demo preview. Actions: exists, click, fill, expectText. Use CSS selectors. Scenarios run in order and share state; external fetch/XHR is blocked. A passing smoke test does not prove every feature works.</p>
    <textarea aria-label="Test scenarios JSON" className="h-56 w-full rounded border border-slate-700 bg-slate-900 p-3 font-mono text-xs" value={text} onChange={e => setText(e.target.value)} disabled={pending} />
    <button disabled={pending} className="rounded bg-indigo-600 px-4 py-2 disabled:opacity-40" onClick={() => { try { const scenarios = parseScenarios(text); save('s2ui.tests.v1', text); setResults([]); setError(''); setPending(true); setRun({ token: crypto.randomUUID(), scenarios }); } catch (e) { setError((e as Error).message); } }}>{pending ? 'Running…' : 'Run scenarios'}</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <ul aria-label="Test results">{results.map((result, i) => <li key={i} className={result.passed ? 'text-emerald-300' : 'text-red-300'}>{result.passed ? 'PASS' : 'FAIL'} — {result.name}: {result.detail}</li>)}</ul>
    {run && <iframe key={run.token} ref={frame} title="Test preview" srcDoc={html} sandbox="allow-scripts" className="h-96 w-full bg-white" />}
  </div></div>;
}
