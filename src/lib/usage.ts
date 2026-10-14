import { load, save } from './storage';
export interface UsagePolicy { maxRequests: number; maxTokens: number; maxUsd: number; prices: Record<string, { input: number; output: number }> }
export interface UsageRecord { id: string; model: string; provider: string; started: number; duration: number; input: number; output: number; actual: boolean; cost: number | null; status: 'running' | 'done' | 'failed' | 'cancelled' }
export const USAGE_KEY = 's2ui.usage.v1'; export const POLICY_KEY = 's2ui.usage-policy.v1';
export const DEFAULT_POLICY: UsagePolicy = { maxRequests: 50, maxTokens: 200000, maxUsd: 0, prices: {} };
let memory: UsageRecord[] = [];
const emit = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('s2ui-usage-change')); };
const store = (rows: UsageRecord[]) => { if (typeof localStorage === 'undefined') memory = rows; else save(USAGE_KEY, rows); emit(); };
let initialized = false;
export const usage = () => { let rows = typeof localStorage === 'undefined' ? memory : load<UsageRecord[]>(USAGE_KEY, []); if (!initialized) { initialized = true; if (rows.some(r => r.status === 'running')) { rows = rows.map(r => r.status === 'running' ? { ...r, status: 'cancelled' as const } : r); store(rows); } } return rows; };
export const policy = () => load<UsagePolicy>(POLICY_KEY, DEFAULT_POLICY);
const pending = new Set<string>();
export function fingerprint(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
export function reserveRequest(model: string, provider: string, text: string, images: string[]) {
 const limits = policy(); const records = usage(); const key = fingerprint(model + provider + text + images.join(''));
 if (pending.has(key)) throw new Error('An identical request is already running.');
 const input = Math.ceil(text.length / 4) + images.length * 1536; const output = 16384;
 const price = limits.prices[model]; const cost = price ? (input * price.input + output * price.output) / 1e6 : null;
 if (records.length >= limits.maxRequests) throw new Error('Request budget reached. Adjust limits or reset the usage window.');
 if (records.reduce((n, r) => n + r.input + r.output, 0) + input + output > limits.maxTokens) throw new Error('Estimated token budget reached.');
 if (limits.maxUsd > 0 && (!price || records.some(r => r.cost === null))) throw new Error('Configure model prices and reset unpriced usage before using a dollar budget.');
 if (limits.maxUsd > 0 && records.reduce((n, r) => n + (r.cost || 0), 0) + (cost || 0) > limits.maxUsd) throw new Error('Estimated cost budget reached.');
 const record: UsageRecord = { id: crypto.randomUUID(), model, provider, started: Date.now(), duration: 0, input, output, actual: false, cost, status: 'running' };
 pending.add(key); store([...records, record]);
 return (status: UsageRecord['status'], outputText: string, actual?: { input: number; output: number }) => {
  pending.delete(key);
  const nextInput = actual?.input ?? input; const nextOutput = actual?.output ?? Math.ceil(outputText.length / 4);
  const finished = { ...record, status, duration: Date.now() - record.started, input: nextInput, output: nextOutput, actual: !!actual, cost: price ? (nextInput * price.input + nextOutput * price.output) / 1e6 : null };
  store(usage().map(r => r.id === record.id ? finished : r));
 };
}
