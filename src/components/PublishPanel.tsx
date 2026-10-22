import { tr } from '../lib/i18n';
import { useMemo, useState } from 'react';
import { encodeReview, reviewBundle } from '../lib/review';
import { qrMatrix, qrSvgPath } from '../lib/qr';
import type { ScreenProject } from '../lib/screens';
import type { BackendConfig } from '../lib/backend';

/**
 * One-click Publish: builds an #app= link (same compressed snapshot format
 * as review links) that opens the current generated app full-screen, plus a
 * locally generated QR code for the link when it fits a QR symbol.
 */
export function PublishPanel({ project, backend, onClose }: { project: ScreenProject; backend: BackendConfig; onClose: () => void }) {
  const signature = JSON.stringify(reviewBundle(project, backend));
  const bundle = useMemo(() => JSON.parse(signature) as ReturnType<typeof reviewBundle>, [signature]);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const matrix = useMemo(() => (link ? qrMatrix(link) : null), [link]);
  const input = 'w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2';
  return (
    <div role="dialog" aria-label={tr("Publish app")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-auto rounded-xl bg-[var(--ui-surface)] p-5">
        <div className="flex justify-between"><h2 className="font-bold">{tr("Publish app")}</h2><button onClick={onClose}>{tr("Close")}</button></div>
        <p className="text-sm text-[var(--ui-muted)]">{tr("Publish puts the current app on a shareable link that opens it full-screen - no editor, no settings, no API keys. The link contains a compressed snapshot of the app, like a review link.")}</p><p className="text-sm text-[var(--ui-muted)]">{tr("About app data: inside Sketch2UI previews, the editor keeps an app's localStorage per screen, so data survives design edits here. In shared and published links it lasts only while the page is open — it is not saved on a server. In an exported standalone HTML file or project, the browser's real localStorage applies.")}</p>
        <button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const url = new URL(location.origin + location.pathname); url.hash = `app=${await encodeReview(bundle)}`; setLink(url.toString()); } catch (e) { const m = (e as Error).message; setError(m.includes('too large') ? 'This app is too large for a publish link (60 KB encoded limit). Export the project ZIP or push it to GitHub instead.' : m); } finally { setBusy(false); } }} className="rounded ui-primary px-4 py-2 disabled:opacity-40">{busy ? tr("Preparing…") : tr("Create publish link")}</button>
        {link && (
          <>
            <textarea dir="ltr" aria-label={tr("Publish link")} readOnly className={`${input} h-24 text-xs`} value={link} />
            <p className="link-length text-xs text-[var(--ui-muted)]">{tr("Link length: {0} characters", [link.length])}</p>
            {link.length > 8000 && <p role="status" className="text-xs text-[var(--ui-text)]">{tr("Very long links can be truncated by some chat and email apps. For a large app, export the project ZIP or use Export to GitHub instead.")}</p>}
            <div className="flex gap-4">
              <button onClick={async () => { try { await navigator.clipboard.writeText(link); } catch { setError('Copy the link from the text field.'); } }}>{tr("Copy link")}</button>
              <a href={link} target="_blank" rel="noreferrer" className="text-[var(--ui-text)]">{tr("Open published app")}</a>
            </div>
            {matrix ? (
              <div className="space-y-2">
                <svg viewBox={`0 0 ${matrix.length + 8} ${matrix.length + 8}`} style={{ width: 192, height: 192, background: '#fff', borderRadius: 8 }} role="img" aria-label={tr("QR code for the published app")}><path d={qrSvgPath(matrix)} fill="#000" /></svg>
                <p className="text-xs text-[var(--ui-muted)]">{tr("Scan to open the app")}</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--ui-muted)]">{tr("This link is too long for a QR code.")}</p>
            )}
          </>
        )}
        {error && <p role="alert" className="text-[var(--ui-text)]">{tr(error)}</p>}
      </section>
    </div>
  );
}
