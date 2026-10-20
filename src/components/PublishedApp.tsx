import { tr, screenLabel } from '../lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import { decodeReview, type ReviewBundle } from '../lib/review';
import { buildPreviewHtml } from '../lib/preview';

/**
 * App-only published view for #app=<encoded> links (created by Publish).
 * Renders the generated app full-screen - no editor chrome, no settings,
 * no API keys. Uses the same compressed bundle format as review links;
 * decodeReview forces the demo backend, so published apps never reach a
 * live backend configured by the author.
 */
export function PublishedApp({ encoded }: { encoded: string }) {
  const [bundle, setBundle] = useState<ReviewBundle | null>(null);
  const [active, setActive] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    decodeReview(encoded)
      .then((value) => { if (alive) { setBundle(value); setActive(value.activeId); } })
      .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [encoded]);
  const screen = bundle?.screens.find((s) => s.id === active) || bundle?.screens[0];
  const html = useMemo(() => (screen && bundle ? buildPreviewHtml(screen.code, undefined, bundle.backend) : ''), [screen, bundle]);
  if (error) return <div style={{ padding: 24, color: 'var(--ui-text)' }}>{tr("Unable to open this published app.")}</div>;
  if (!bundle || !screen) return <div style={{ padding: 24, color: 'var(--ui-text)' }}>{tr("Loading app…")}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--ui-bg)', color: 'var(--ui-text)' }}>
      {bundle.screens.length > 1 && (
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, borderBottom: '1px solid var(--ui-border)' }}>
          {bundle.screens.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)} className={s.id === screen.id ? 'rounded ui-primary px-3 py-1' : 'rounded border border-[var(--ui-border)] px-3 py-1'}>{screenLabel(s)}</button>
          ))}
        </nav>
      )}
      <iframe title={screenLabel(screen)} sandbox="allow-scripts allow-forms allow-modals allow-popups" srcDoc={html} style={{ flex: 1, border: 0, width: '100%', background: 'var(--ui-surface)' }} />
      <footer style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderTop: '1px solid var(--ui-border)', fontSize: 12, color: 'var(--ui-muted)' }}>
        <span>{tr("Published with Sketch2UI")}</span>
        <a href={location.pathname} style={{ marginInlineStart: 'auto', color: 'var(--ui-text)' }}>{tr("Create your own")}</a>
      </footer>
    </div>
  );
}
