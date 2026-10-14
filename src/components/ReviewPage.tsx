import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeReview, downloadComments, reviewId, type ReviewBundle, type ReviewComment } from '../lib/review';
import { buildPreviewHtml } from '../lib/preview';
import { describeElement } from '../lib/visualEdit';
import { load, save } from '../lib/storage';
import { ThemeToggle } from './ThemeProvider';
export function ReviewPage({ encoded }: { encoded: string }) {
  const [bundle, setBundle] = useState<ReviewBundle | null>(null); const [id, setId] = useState(''); const [active, setActive] = useState('');
  const [comments, setComments] = useState<ReviewComment[]>([]); const [selected, setSelected] = useState<number | null>(null);
  const [author, setAuthor] = useState(''); const [text, setText] = useState(''); const [error, setError] = useState(''); const [commenting, setCommenting] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { let alive = true; decodeReview(encoded).then(async value => { const key = await reviewId(value); if (!alive) return; setBundle(value); setActive(value.activeId); setId(key); setComments(load(`s2ui.review.${key}`, [])); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [encoded]);
  useEffect(() => { if (id) save(`s2ui.review.${id}`, comments); }, [id, comments]);
  const screen = bundle?.screens.find(s => s.id === active) || bundle?.screens[0];
  const token = useMemo(() => crypto.randomUUID(), [screen?.id]);
  const html = useMemo(() => screen && bundle ? buildPreviewHtml(screen.code, { token, tests: true }, bundle.backend) : '', [screen, bundle, token]);
  const sendMode = () => frame.current?.contentWindow?.postMessage({ type: 'edit-mode', token, enabled: commenting }, '*');
  useEffect(() => { sendMode(); }, [token, commenting]);
  useEffect(() => {
    const handle = (e: MessageEvent) => { if (e.source !== frame.current?.contentWindow || e.data?.source !== 's2ui-preview') return;
      if (e.data.type === 'ready') sendMode();
      if (e.data.type === 'element-selected' && e.data.token === token && Number.isInteger(e.data.id) && screen) { try { describeElement(screen.code, e.data.id); setSelected(e.data.id); } catch { setSelected(null); } }
      if (e.data.type === 'error') setError(String(e.data.message));
    }; window.addEventListener('message', handle); return () => window.removeEventListener('message', handle);
  }, [token, screen, commenting]);
  return <div className="flex h-screen flex-col bg-[var(--ui-bg)] text-[var(--ui-text)]"><header className="flex flex-wrap items-center gap-3 border-b border-[var(--ui-border)] p-3"><h1 className="font-bold">Sketch2UI Review</h1><span className="text-xs text-[var(--ui-muted)]">Read-only source · demo API · local comments</span><ThemeToggle /><button className="rounded border px-3 py-1" onClick={() => { setCommenting(!commenting); setSelected(null); }}>{commenting ? 'Interact with preview' : 'Comment on element'}</button><button disabled={!comments.length} onClick={() => downloadComments(id, comments)} className="rounded ui-primary px-3 py-1 disabled:opacity-40">Download comments</button><a href={location.pathname} className="ml-auto text-sm text-[var(--ui-text)]">Open editor</a></header>
    {error && <p role="alert" className="px-3 py-2 text-[var(--ui-text)]">{error}</p>}
    {bundle ? <><nav className="flex flex-wrap gap-2 p-2">{bundle.screens.map(s => <button key={s.id} onClick={() => { setActive(s.id); setSelected(null); setError(''); }} className={`rounded px-3 py-1 ${s.id === screen?.id ? 'ui-primary' : 'border border-[var(--ui-border)]'}`}>{s.name}</button>)}</nav><main className="flex min-h-0 flex-1 flex-col md:flex-row"><iframe ref={frame} title="Review preview" sandbox="allow-scripts" srcDoc={html} className="min-h-64 flex-1 bg-[var(--ui-surface)]" /><aside className="w-full overflow-auto p-4 md:w-80"><p className="mb-3 text-xs text-[var(--ui-muted)]">Select an element, add feedback, then download the comments file and return it to the author. Comments are saved on this browser; they do not sync automatically.</p>{selected !== null && <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (!text.trim() || !screen) return; setComments(prev => [...prev, { id: crypto.randomUUID(), screenId: screen.id, elementId: selected, text: text.trim(), author: author.trim() || 'Reviewer', createdAt: new Date().toISOString() }]); setText(''); }}><p>Selected element #{selected}</p><input aria-label="Reviewer name" placeholder="Your name" className="w-full rounded bg-[var(--ui-hover)] p-2" value={author} onChange={e => setAuthor(e.target.value)} /><textarea aria-label="Element comment" maxLength={5000} className="w-full rounded bg-[var(--ui-hover)] p-2" value={text} onChange={e => setText(e.target.value)} /><button disabled={!text.trim()} className="rounded ui-primary px-3 py-1 disabled:opacity-40">Add comment</button></form>}<ul className="mt-4 space-y-3">{comments.filter(c => c.screenId === screen?.id).map(c => <li key={c.id} className="rounded border border-[var(--ui-border)] p-3 text-sm"><strong>{c.author} · #{c.elementId}</strong><p className="my-2 whitespace-pre-wrap">{c.text}</p><button onClick={() => setComments(prev => prev.filter(item => item.id !== c.id))} className="text-[var(--ui-text)]">Remove comment</button></li>)}</ul></aside></main></> : <p className="p-4">{error ? 'Unable to open this review.' : 'Loading review…'}</p>}
  </div>;
}
