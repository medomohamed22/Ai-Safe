export interface TestStep { action: 'exists' | 'click' | 'fill' | 'expectText'; selector: string; value?: string }
export interface Scenario { name: string; steps: TestStep[] }
export interface ScenarioResult { name: string; passed: boolean; detail: string }

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
      if (['fill', 'expectText'].includes(step.action) && typeof step.value !== 'string') throw new Error('fill and expectText require a string value.');
    }
  }
  if (count > 50) throw new Error('Maximum 50 total test steps.');
  return data;
}

// Runs only inside a separate preview iframe; uses the actual rendered React DOM.
export function installTestRunner(token: string) {
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
    if (e.source !== parent || e.data?.token !== token || e.data.type !== 'run-tests' || running) return;
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
            element = document.querySelector(step.selector);
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
        results.push({ name: scenario.name, passed: true, detail: `${stepNumber} steps passed` });
      } catch (error) { results.push({ name: scenario.name, passed: false, detail: `Step ${stepNumber}: ${(error as Error).message}` }); }
    }
    parent.postMessage({ source: 's2ui-tests', token, results }, '*');
    running = false;
  });
}
