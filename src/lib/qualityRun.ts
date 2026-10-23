import { buildPreviewHtml } from './preview';
import { materializeAssets } from './designAssets';
import { materializeLibrary } from './componentLibrary';
import { sourceChecks } from './quality';
import { serviceRequest } from './services';
import type { Scenario, ScenarioResult } from './interactionTests';
import type { BackendConfig } from './backend';

/**
 * The automatic quality check, runnable anywhere — the Productivity
 * Studio's Quality tab and the background pass that runs after a
 * generation (whose result lands on the preview, without stealing the
 * view). The runtime part renders the app in an offscreen sandboxed
 * iframe per viewport width and collects the in-document audit.
 */
export function runRuntimeChecks(code: string, backend: BackendConfig, width: number, scenarios: Scenario[], timeoutMs = 45000): Promise<ScenarioResult[]> {
  return new Promise((resolve) => {
    const token = crypto.randomUUID();
    const iframe = document.createElement('iframe');
    iframe.title = 'Quality preview';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:520px;border:0;visibility:hidden`;
    let dispatched = false;
    const done = (rows: ScenarioResult[]) => { cleanup(); resolve(rows); };
    const timer = window.setTimeout(() => done([{ name: 'Runtime', passed: false, detail: 'Preview timed out or a required CDN could not load.' }]), timeoutMs);
    const handler = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      if (e.data?.source === 's2ui-preview' && e.data.type === 'error') done([{ name: 'Runtime', passed: false, detail: String(e.data.message) }]);
      if (e.data?.source === 's2ui-preview' && e.data.type === 'ready' && !dispatched) { dispatched = true; iframe.contentWindow?.postMessage({ type: 'quality-check', token, scenarios }, '*'); }
      if (e.data?.source === 's2ui-quality' && e.data.token === token && Array.isArray(e.data.results)) done(e.data.results as ScenarioResult[]);
    };
    const cleanup = () => { window.clearTimeout(timer); window.removeEventListener('message', handler); iframe.remove(); };
    window.addEventListener('message', handler);
    iframe.srcdoc = buildPreviewHtml(code, { token, tests: true }, { ...backend, mode: 'demo' });
    document.body.appendChild(iframe);
  });
}

const BUNDLE_BLOCKED: ScenarioResult = { name: 'Production JavaScript bundle', passed: false, status: 'blocked', detail: 'Build check service unavailable on this deployment, so the bundle was not verified. This is an environment limit, not a code failure. See the README section on running the quality build service.' };

/** Source checks → production bundle (service-dependent) → runtime audit
 *  at phone, tablet and desktop widths. */
export async function runFullQualityCheck(code: string, backend: BackendConfig, scenarios: Scenario[] = [], isCancelled?: () => boolean): Promise<ScenarioResult[]> {
  const result = sourceChecks(code);
  if (result.some((r) => !r.passed)) return result;
  try {
    const response = await serviceRequest('/api/quality', { code: materializeAssets(materializeLibrary(code)) });
    const bundle = await response.json().catch(() => null);
    if (response.ok && bundle && typeof bundle.passed === 'boolean') result.push({ name: 'Production JavaScript bundle', passed: bundle.passed, status: bundle.passed ? 'passed' : 'failed', detail: bundle.detail || bundle.error || 'Bundle compiled' });
    else result.push({ ...BUNDLE_BLOCKED });
  } catch { result.push({ ...BUNDLE_BLOCKED }); }
  if (!scenarios.length) result.push({ name: 'Acceptance scenarios', passed: false, status: 'untested', detail: 'No acceptance scenarios were provided or generated, so feature behavior is unverified. Add acceptance goals above to generate scenarios.' });
  for (const width of [390, 820, 1440]) {
    if (isCancelled?.()) break;
    const runtime = await runRuntimeChecks(code, backend, width, scenarios);
    result.push(...runtime.map((r) => ({ ...r, name: `${width}px · ${r.name}` })));
    if (runtime.some((r) => r.name === 'Runtime' && !r.passed)) break;
  }
  return result;
}
