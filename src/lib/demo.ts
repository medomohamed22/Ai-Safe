/** Hosted demo mode client helpers (see api/demo.js and api/proxy.js). */
export const DEMO_CHECKED_KEY = 's2ui.demo.checked.v1';
export const DEMO_DISMISSED_KEY = 's2ui.demo.dismissed.v1';

export interface DemoStatus {
  demo: boolean;
  model: string;
}

const FALLBACK: DemoStatus = { demo: false, model: 'muse-spark-1.3' };

export async function fetchDemoStatus(): Promise<DemoStatus> {
  try {
    const res = await fetch('/api/demo', { headers: { accept: 'application/json' } });
    if (!res.ok) return FALLBACK;
    const j = await res.json();
    return { demo: !!j?.demo, model: typeof j?.model === 'string' ? j.model : FALLBACK.model };
  } catch {
    return FALLBACK;
  }
}
