/**
 * The visible production line: every generation run moves through named
 * stages (understand -> plan -> design system -> build -> assets -> review
 * -> ship), each badged with the model that actually did the work. App owns
 * the live stage state; a compact snapshot is stored on the built chat
 * message so the finished pipeline stays visible in the thread history.
 */
export type StageId = 'understand' | 'plan' | 'design' | 'build' | 'assets' | 'review' | 'ship';
export type StageStatus = 'todo' | 'active' | 'done' | 'skipped' | 'error';

export interface StageEvent {
  id: StageId;
  status: StageStatus;
  detail?: string;
  model?: string;
  ms?: number;
}

export interface StageSnapshot {
  id: StageId;
  status: StageStatus;
  detail?: string;
  model?: string;
}

export const STAGE_ORDER: StageId[] = ['understand', 'plan', 'design', 'build', 'assets', 'review', 'ship'];

export const STAGE_LABELS: Record<StageId, string> = {
  understand: 'Understand',
  plan: 'Plan',
  design: 'Design system',
  build: 'Build',
  assets: 'Assets',
  review: 'Review',
  ship: 'Ship',
};

export function freshStages(): StageEvent[] {
  return STAGE_ORDER.map((id) => ({ id, status: 'todo' }));
}

export function setStage(stages: StageEvent[], id: StageId, patch: Partial<StageEvent>): StageEvent[] {
  return stages.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

/** Stages worth persisting on the built message (anything that ran or was deliberately skipped). */
export function snapshotStages(stages: StageEvent[]): StageSnapshot[] {
  return stages
    .filter((s) => s.status !== 'todo')
    .map(({ id, status, detail, model }) => ({ id, status, detail, model }));
}
