import { useEffect, useRef, useState } from 'react';
import { Check, Circle, ClipboardList, Loader2, Minus, PenLine, RotateCcw, Sparkles, Wrench, X } from 'lucide-react';
import { tr } from '../lib/i18n';
import type { ChatMessage } from '../lib/screens';
import { STAGE_LABELS, type StageEvent, type StageSnapshot } from '../lib/pipeline';
import type { BuildPlan } from '../lib/plans';

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="chat-elapsed">{s}s</span>;
}

function StageIcon({ status }: { status: StageEvent['status'] }) {
  if (status === 'done') return <Check size={12} />;
  if (status === 'active') return <Loader2 size={12} className="animate-spin" />;
  if (status === 'skipped') return <Minus size={12} />;
  if (status === 'error') return <X size={12} />;
  return <Circle size={8} />;
}

function StageRow({ stage, live }: { stage: StageEvent | StageSnapshot; live?: boolean }) {
  return (
    <div className={`chat-step stage-${stage.status}`}>
      <span className={`chat-step-icon ${stage.status}`}>
        <StageIcon status={stage.status} />
      </span>
      <span className="stage-label">{tr(STAGE_LABELS[stage.id])}</span>
      {stage.model && <span className="stage-model">{stage.model}</span>}
      {stage.detail && <span className="stage-detail">{stage.detail}</span>}
      {live && stage.status === 'active' && <Elapsed />}
    </div>
  );
}

/**
 * The conversation column's thread: the user's instructions and the AI's
 * replies (built / error / stopped), the live production line while a
 * generation runs (one row per pipeline stage, badged with the model doing
 * the work), the finished stage summary kept on each built reply, and the
 * plan-approval gate card shown before a build when Plan-first is on.
 * Presentation only — App owns the messages, the stages and the run.
 */
export function ChatThread(p: {
  messages: ChatMessage[];
  generating: boolean;
  stream: string;
  segmentReady: boolean;
  hasCode: boolean;
  suggestions: string[];
  starters: string[];
  stages?: StageEvent[];
  planGate?: { plan: BuildPlan } | null;
  onApprovePlan?: () => void;
  onSkipPlan?: () => void;
  onEditPlan?: () => void;
  onSendSuggestion: (text: string) => void;
  onRetry: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [p.messages, p.generating, p.stream.length, p.stages, p.planGate]);
  const last = p.messages[p.messages.length - 1];
  const liveStages = (p.stages ?? []).filter((s) => s.status !== 'todo');
  return (
    <div className="chat-thread" ref={scrollRef}>
      {p.messages.length === 0 && !p.generating && (
        <div className="chat-empty">
          <p>{tr('Describe a new interface or refine the current screen.')}</p>
          <div className="chat-starters">
            {p.starters.map((q) => (
              <button key={q} className="quick-prompt" onClick={() => p.onSendSuggestion(tr(q))}>{tr(q)}</button>
            ))}
          </div>
        </div>
      )}
      {p.messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="chat-msg user">
            <p>
              {m.kind === 'sketch' ? (
                <><PenLine size={13} /> {tr('Generate from sketch')}</>
              ) : m.kind === 'fix' ? (
                <><Wrench size={13} /> {tr('Fix the runtime error')}</>
              ) : (
                m.text
              )}
            </p>
          </div>
        ) : (
          <div key={m.id} className={`chat-msg ai ${m.kind || ''}`}>
            {m.kind === 'built' && (
              <p><Check size={13} /> {tr('Your new version is ready in the preview.')}</p>
            )}
            {m.kind === 'stopped' && <p>{tr('Generation stopped.')}</p>}
            {m.kind === 'error' && (
              <>
                <p>{m.text}</p>
                {last?.id === m.id && (
                  <button className="ui-button chat-retry" onClick={p.onRetry}>
                    <RotateCcw size={13} />
                    {tr('Retry')}
                  </button>
                )}
              </>
            )}
            {m.kind === 'built' && m.stages && m.stages.length > 0 && (
              <div className="chat-stages-summary">
                {m.stages.map((s) => (
                  <StageRow key={s.id} stage={s} />
                ))}
              </div>
            )}
          </div>
        ),
      )}
      {p.generating && (
        <div className="chat-msg ai pending" aria-live="polite">
          {liveStages.length > 0 ? (
            liveStages.map((s) => <StageRow key={s.id} stage={s} live />)
          ) : (
            <>
              <div className="chat-step">
                <span className={`chat-step-icon ${p.stream || p.segmentReady ? 'done' : 'active'}`}>
                  {p.stream || p.segmentReady ? <Check size={12} /> : <Loader2 size={12} className="animate-spin" />}
                </span>
                {tr('Analyzing your sketch…')}
              </div>
              <div className="chat-step">
                <span className={`chat-step-icon ${p.stream ? 'active' : 'todo'}`}>
                  {p.stream ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                </span>
                {tr('Generating the interface…')}
                {p.stream ? <span className="chat-chars">{p.stream.length.toLocaleString()}</span> : null}
                <Elapsed />
              </div>
            </>
          )}
        </div>
      )}
      {p.planGate && !p.generating && (
        <div className="chat-msg ai plan-gate">
          <p className="plan-gate-title">
            <ClipboardList size={13} /> {tr('Plan draft — review before building')}
          </p>
          <p className="plan-gate-summary">{p.planGate.plan.summary}</p>
          <ol className="plan-gate-reqs">
            {p.planGate.plan.requirements.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ol>
          <div className="plan-gate-actions">
            <button className="ui-primary" onClick={p.onApprovePlan}>{tr('Approve plan & build')}</button>
            <button className="ui-button" onClick={p.onSkipPlan}>{tr('Build without a plan')}</button>
            <button className="ui-button" onClick={p.onEditPlan}>{tr('Edit plan')}</button>
          </div>
        </div>
      )}
      {!p.generating && !p.planGate && p.hasCode && p.suggestions.length > 0 && (
        <div className="chat-suggestions">
          <span className="next-steps-label">{tr('Next steps')}</span>
          <div>
            {p.suggestions.map((q) => (
              <button key={q} className="quick-prompt" onClick={() => p.onSendSuggestion(tr(q))}>{tr(q)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
