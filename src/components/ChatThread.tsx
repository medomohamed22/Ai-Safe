import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, PenLine, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { tr } from '../lib/i18n';
import type { ChatMessage } from '../lib/screens';

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="chat-elapsed">{s}s</span>;
}

/**
 * The conversation column's thread: the user's instructions and the AI's
 * replies (built / error / stopped), plus a live pending reply while a
 * generation runs. Presentation only — App owns the messages and the run.
 */
export function ChatThread(p: {
  messages: ChatMessage[];
  generating: boolean;
  stream: string;
  segmentReady: boolean;
  hasCode: boolean;
  suggestions: string[];
  starters: string[];
  onSendSuggestion: (text: string) => void;
  onRetry: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [p.messages, p.generating, p.stream.length]);
  const last = p.messages[p.messages.length - 1];
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
          </div>
        ),
      )}
      {p.generating && (
        <div className="chat-msg ai pending" aria-live="polite">
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
        </div>
      )}
      {!p.generating && p.hasCode && p.suggestions.length > 0 && (
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
