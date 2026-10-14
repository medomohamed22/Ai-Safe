import { useMemo, useState } from 'react';
import { createBackend, importOpenApi, type BackendConfig } from '../lib/backend';

export function BackendPanel({ config, onChange, onClose }: { config: BackendConfig; onChange: (v: BackendConfig) => void; onClose: () => void }) {
  const [selected, setSelected] = useState(0);
  const [args, setArgs] = useState('{}');
  const [token, setToken] = useState('');
  const [result, setResult] = useState('');
  const [pending, setPending] = useState(false);
  const endpoint = config.endpoints[selected];
  const api = useMemo(() => createBackend(config), [config]);
  const input = 'rounded border border-slate-600 bg-slate-950 p-2 text-sm';
  const update = (patch: Partial<typeof endpoint>) => onChange({ ...config, endpoints: config.endpoints.map((e, i) => i === selected ? { ...e, ...patch } : e) });
  const test = async () => {
    setPending(true); setResult('');
    const ctrl = new AbortController(); const timeout = setTimeout(() => ctrl.abort(), 15000);
    try {
      const value = JSON.parse(args);
      const data = await api.request(endpoint.id, { ...value, signal: ctrl.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setResult(JSON.stringify({ mode: config.mode, operation: endpoint.id, response: data }, null, 2));
    } catch (e) { setResult(`Failed: ${(e as Error).message}`); }
    finally { clearTimeout(timeout); setPending(false); }
  };
  return <div role="dialog" aria-label="Backend connection" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-5">
    <div className="flex justify-between"><h2 className="font-bold">Backend connection</h2><button onClick={onClose}>Close</button></div>
    <p className="text-xs text-slate-400">Import OpenAPI 3 JSON, map returned fields, then test. Demo is the default. Real API mode requires CORS on your backend. Authentication is session-only in this tester.</p>
    <label className="block text-sm">OpenAPI JSON<input aria-label="OpenAPI JSON" type="file" accept=".json,application/json" className="block" onChange={async e => { try { const file = e.target.files?.[0]; if (file) { if (file.size > 1000000) throw new Error('Maximum contract size is 1 MB.'); onChange(importOpenApi(await file.text())); setSelected(0); setResult('Contract imported.'); } } catch (err) { setResult((err as Error).message); } }} /></label>
    <div className="flex flex-wrap gap-2"><label className="flex-1">API base URL<input aria-label="API base URL" className={`${input} block w-full`} value={config.baseUrl} placeholder="https://api.example.com/v1" onChange={e => onChange({ ...config, baseUrl: e.target.value })} /></label><label>Mode<select aria-label="API mode" className={`${input} block`} value={config.mode} onChange={e => onChange({ ...config, mode: e.target.value as BackendConfig['mode'] })}><option value="demo">Demo</option><option value="http">Real API</option></select></label></div>
    <button className="rounded border border-slate-600 px-3 py-1" onClick={() => { onChange({ ...config, endpoints: [...config.endpoints, { id: `operation_${config.endpoints.length + 1}`, method: 'GET', path: '/items', dataPath: '', fields: {} }] }); setSelected(config.endpoints.length); }}>Add endpoint</button>
    {!!config.endpoints.length && <select aria-label="API operation" className={`${input} block w-full`} value={selected} onChange={e => setSelected(Number(e.target.value))}>{config.endpoints.map((e, i) => <option key={i} value={i}>{e.method} {e.path} ({e.id})</option>)}</select>}
    {endpoint && <><div className="grid grid-cols-2 gap-2"><label>Operation ID<input className={`${input} w-full`} value={endpoint.id} onChange={e => update({ id: e.target.value })} /></label><label>Method<select className={`${input} w-full`} value={endpoint.method} onChange={e => update({ method: e.target.value })}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}</select></label><label>Path<input className={`${input} w-full`} value={endpoint.path} onChange={e => update({ path: e.target.value })} /></label><label>Response path<input aria-label="Response path" className={`${input} w-full`} placeholder="data.items" value={endpoint.dataPath} onChange={e => update({ dataPath: e.target.value })} /></label></div>
    <label className="block">Field mapping (UI field → API field)<input aria-label="Field mapping" key={`${selected}:${JSON.stringify(endpoint.fields)}`} className={`${input} w-full`} defaultValue={JSON.stringify(endpoint.fields)} onBlur={e => { try { const v = JSON.parse(e.target.value); if (!v || Array.isArray(v) || typeof v !== 'object' || Object.values(v).some(x => typeof x !== 'string')) throw new Error('Use a JSON object of string field names.'); update({ fields: v }); } catch (err) { setResult((err as Error).message); } }} /></label>
    <label className="block">Request arguments (params, query, body)<textarea aria-label="Request arguments" className={`${input} w-full font-mono`} value={args} onChange={e => setArgs(e.target.value)} /></label>
    <label className="block">Bearer token for this test only<input aria-label="Test bearer token" type="password" autoComplete="off" className={`${input} w-full`} value={token} onChange={e => setToken(e.target.value)} /></label>
    {config.mode === 'http' && endpoint.method !== 'GET' && <p className="text-amber-200">This test sends a real {endpoint.method} request and may change your backend data.</p>}
    <button disabled={pending} onClick={test} className="rounded bg-indigo-600 px-4 py-2 disabled:opacity-40">{pending ? 'Testing…' : `Test ${endpoint.method} (${config.mode})`}</button></>}
    <pre role="status" className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{result}</pre>
    <p className="text-xs text-slate-400">The saved contract is included in future generation requests. Regenerate/update existing code to adopt it. The exported project includes the same runtime adapter.</p>
  </section></div>;
}
