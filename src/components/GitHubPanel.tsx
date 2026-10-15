import { tr } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { createGitHubBranch, createGitHubPR, reviewGitHub, type GitReview } from '../lib/github';
export function GitHubPanel({ files, onClose }: { files: Record<string, string>; onClose: () => void }) {
  const [repo, setRepo] = useState(''); const [token, setToken] = useState(''); const [folder, setFolder] = useState('');
  const [branch, setBranch] = useState(`sketch2ui-${Date.now()}`);
  const [review, setReview] = useState<GitReview | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [branchUrl, setBranchUrl] = useState(''); const [prUrl, setPrUrl] = useState('');
  useEffect(() => { setReview(null); setBranchUrl(''); setPrUrl(''); }, [repo, token, folder, branch, files]);
  const input = 'w-full rounded border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2';
  const publish = async () => {
    if (!review) return; setBusy(true); setError('');
    try { if (!branchUrl) setBranchUrl(await createGitHubBranch(review, token, branch)); const pr = await createGitHubPR(review, token, branch); setPrUrl(pr.html_url); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div role="dialog" aria-label={tr("GitHub export")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-3xl space-y-3 overflow-auto rounded-xl bg-[var(--ui-surface)] p-5">
    <div className="flex justify-between"><h2 className="font-bold">{tr("GitHub export")}</h2><button disabled={busy} onClick={onClose}>{tr("Close")}</button></div>
    <p className="text-xs text-[var(--ui-muted)]">{tr("Review exported files, then create a new branch and Pull Request. No files are deleted. Merge in GitHub when ready for your connected Vercel deployment. The repository must have an existing commit.")}</p>
    <fieldset disabled={busy || !!branchUrl} className="grid gap-2 sm:grid-cols-2"><label>{tr("Repository")}<input dir="ltr" aria-label={tr("GitHub repository")} placeholder={tr("owner/repo")} className={input} value={repo} onChange={e => setRepo(e.target.value.trim())} /></label><label>{tr("Destination folder (optional)")}<input dir="ltr" aria-label={tr("GitHub destination folder")} className={input} value={folder} onChange={e => setFolder(e.target.value)} /></label><label>{tr("Session token")}<input aria-label={tr("GitHub session token")} type="password" autoComplete="off" className={input} value={token} onChange={e => setToken(e.target.value)} /></label><label>{tr("New branch")}<input dir="ltr" aria-label={tr("GitHub new branch")} className={input} value={branch} onChange={e => setBranch(e.target.value)} /></label></fieldset>
    <p className="text-xs text-[var(--ui-muted)]">{tr("Use a repository-scoped token with Contents and Pull requests write permissions. It stays in memory and is discarded when you close this panel.")}</p>
    <button disabled={busy || !!branchUrl} className="rounded border border-[var(--ui-border)] px-4 py-2 disabled:opacity-40" onClick={async () => { setBusy(true); setError(''); try { setReview(await reviewGitHub(repo, token, files, folder)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? tr("Working…") : tr("Review changes")}</button>
    {review && <><p>{review.changes.length}{tr(" changed files compared with ")}{review.baseBranch} ({review.baseSha.slice(0, 8)}).</p><div className="max-h-72 overflow-auto">{review.changes.map(file => <details key={file.path} className="border-b border-[var(--ui-border)] py-2"><summary>{file.previousSha ? tr("Update") : tr("Add")} {file.path}</summary>{file.previousSha && <a href={`https://github.com/${review.repo}/blob/${review.baseSha}/${file.path}`} target="_blank" rel="noreferrer" className="text-[var(--ui-text)]">{tr("View current file on GitHub")}</a>}<pre className="overflow-auto whitespace-pre-wrap break-all p-2 text-xs">{file.content}</pre></details>)}</div><button disabled={busy || !review.changes.length || !!prUrl} onClick={publish} className="rounded ui-primary px-4 py-2 disabled:opacity-40">{branchUrl ? tr("Retry Pull Request") : tr("Create branch and Pull Request")}</button></>}
    {branchUrl && <a href={branchUrl} target="_blank" rel="noreferrer" className="block text-[var(--ui-text)]">{tr("Branch created")}</a>}{prUrl && <a href={prUrl} target="_blank" rel="noreferrer" className="block text-[var(--ui-text)]">{tr("Open Pull Request")}</a>}
    {error && <p role="alert" className="text-[var(--ui-text)]">{tr(error)}</p>}
  </section></div>;
}
