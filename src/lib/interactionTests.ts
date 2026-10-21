export interface TestStep { action: 'exists' | 'click' | 'fill' | 'expectText'; selector: string; value?: string }
export interface Scenario { name: string; steps: TestStep[] }
// Result taxonomy (P1-03): a run must never blur a broken test definition or
// an unavailable environment into an app failure, or claim coverage it did
// not have. `passed` stays as a convenience mirror of status === 'passed'.
export type ResultStatus = 'passed' | 'failed' | 'setup-error' | 'blocked' | 'untested';
export interface ScenarioResult { name: string; passed: boolean; status?: ResultStatus; detail: string }
export function resultStatus(r: ScenarioResult): ResultStatus { return r.status ?? (r.passed ? 'passed' : 'failed'); }
export const STATUS_LABELS: Record<ResultStatus, string> = { passed: 'PASS', failed: 'FAIL', 'setup-error': 'SETUP ERROR', blocked: 'BLOCKED', untested: 'NOT TESTED' };

// The selector contract shared by scenario generation, validation and the
// runner (P1-02): standard CSS, plus ONE explicit text form —
// tag:has-text('Visible text') — which the runner resolves by visible text.
// Any other Playwright-only syntax is a setup error, never an app failure.
export const HAS_TEXT_RE = /^([a-zA-Z][\w-]*)?:has-text\(\s*(['"])((?:(?!\2).)+)\2\s*\)$/;
export function selectorProblem(selector: string): string | null {
  if (selector.includes(':has-text')) return HAS_TEXT_RE.test(selector) ? null : "Unsupported :has-text form. Use tag:has-text('Visible text') with quoted text.";
  if (selector.includes('>>') || selector.includes(':text(') || selector.startsWith('xpath=') || selector.startsWith('//')) return 'Playwright-only selector syntax is not supported. Use standard CSS or tag:has-text(\'Visible text\').';
  return null;
}

export function parseScenarios(text: string): Scenario[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data) || !data.length || data.length > 10) throw new Error('Provide 1–10 test scenarios.');
  let count = 0;
  for (const scenario of data) {
    if (typeof scenario.name !== 'string' || !Array.isArray(scenario.steps) || !scenario.steps.length) throw new Error('Each test needs a name and steps.');
    if (!scenario.steps.some((s: TestStep) => s.action === 'exists' || s.action === 'expectText')) throw new Error('Each test must include an assertion (exists or expectText).');
    for (const step of scenario.steps) {
      count++;
      if (!['exists', 'click', 'fill', 'expectText'].includes(step.action) || typeof step.selector !== 'string' || !step.selector || step.selector.length > 500) throw new Error('Invalid test action or CSS selector.');
      const problem = selectorProblem(step.selector);
      if (problem) throw new Error(`Scenario "${scenario.name}": ${problem}`);
      if (['fill', 'expectText'].includes(step.action) && typeof step.value !== 'string') throw new Error('fill and expectText require a string value.');
    }
  }
  if (count > 50) throw new Error('Maximum 50 total test steps.');
  return data;
}

// Runs only inside a separate preview iframe; uses the actual rendered React DOM.
export function installTestRunner(token: string, audit?: () => ScenarioResult[]) {
  // Self-contained on purpose: this runner is stringified into the preview
  // document, so it cannot import the helpers above. Keep the pattern in
  // sync with HAS_TEXT_RE.
  const HAS_TEXT = /^([a-zA-Z][\w-]*)?:has-text\(\s*(['"])((?:(?!\2).)+)\2\s*\)$/;
  const setupError = (message: string) => { const e = new Error(message) as Error & { setup?: boolean }; e.setup = true; return e; };
  const findElement = (selector: string): Element | null => {
    const textForm = selector.match(HAS_TEXT);
    if (textForm) {
      const tag = (textForm[1] || '*').toLowerCase();
      const wanted = textForm[3].replace(/\s+/g, ' ').trim();
      let best: Element | null = null; let bestLen = Infinity;
      document.querySelectorAll(tag).forEach(el => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.includes(wanted) && text.length < bestLen) { best = el; bestLen = text.length; }
      });
      return best;
    }
    if (selector.includes(':has-text') || selector.includes('>>')) throw setupError(`Unsupported selector form: ${selector}. Use standard CSS or tag:has-text('Visible text').`);
    try { return document.querySelector(selector); }
    catch { throw setupError(`Invalid CSS selector: ${selector}. Fix the test scenario; this is not an app failure.`); }
  };
  let running = false;
  const blocked = () => { throw new Error('External network is disabled during demo interaction tests.'); };
  window.fetch = async () => blocked();
  XMLHttpRequest.prototype.open = blocked;
  window.WebSocket = blocked as any;
  window.EventSource = blocked as any;
  window.open = () => null;
  document.addEventListener('submit', e => e.preventDefault(), true);
  document.addEventListener('click', e => { if ((e.target as Element).closest('a[href]')) e.preventDefault(); }, true);
  window.addEventListener('message', async e => {
    if (e.source !== parent || e.data?.token !== token || !['run-tests', 'quality-check'].includes(e.data.type) || running) return;
    running = true;
    const results: ScenarioResult[] = [];
    for (const scenario of e.data.scenarios as Scenario[]) {
      let stepNumber = 0;
      try {
        for (const step of scenario.steps) {
          stepNumber++;
          const start = Date.now();
          let element: Element | null = null;
          while (Date.now() - start < 2500) {
            element = findElement(step.selector);
            if (element && (step.action !== 'expectText' || element.textContent?.includes(step.value!))) break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          if (!element) throw new Error(`Not found: ${step.selector}`);
          if (step.action === 'expectText' && !element.textContent?.includes(step.value!)) throw new Error(`Expected text ${JSON.stringify(step.value)}, received ${JSON.stringify(element.textContent)}`);
          if (step.action === 'click') {
            if (!(element instanceof HTMLElement) || element.matches(':disabled')) throw new Error('Element cannot be clicked.');
            element.click();
          }
          if (step.action === 'fill') {
            const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : null;
            if (!proto || element.matches(':disabled,[readonly]')) throw new Error('Element is not an editable field.');
            Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, step.value);
            element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        results.push({ name: scenario.name, passed: true, status: 'passed', detail: `${stepNumber} steps passed` });
      } catch (error) { const err = error as Error & { setup?: boolean }; results.push(err.setup ? { name: scenario.name, passed: false, status: 'setup-error', detail: `Test setup error: ${err.message}` } : { name: scenario.name, passed: false, status: 'failed', detail: `Step ${stepNumber}: ${err.message}` }); }
    }
    if (e.data.type === 'quality-check') results.push(...(audit?.() || []));
    parent.postMessage({ source: e.data.type === 'quality-check' ? 's2ui-quality' : 's2ui-tests', token, results }, '*');
    running = false;
  });
}
