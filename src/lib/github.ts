export interface GitReview { repo: string; baseBranch: string; baseSha: string; treeSha: string; changes: { path: string; content: string; previousSha?: string }[] }
const API = 'https://api.github.com';
export async function githubRequest(token: string, route: string, method = 'GET', body?: unknown, fetcher: typeof fetch = fetch) {
  const response = await fetcher(API + route, { method, headers: { Accept: 'application/vnd.github+json', ...(token.trim() ? {Authorization: `Bearer ${token}`} : {}), 'X-GitHub-Api-Version': '2026-03-10', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${result.message || 'Request failed'}`);
  return result;
}
export async function reviewGitHub(repo: string, token: string, files: Record<string, string>, folder = '', fetcher: typeof fetch = fetch): Promise<GitReview> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Use owner/repository.');
  if (folder && (!/^[\w./-]+$/.test(folder) || folder.split('/').some(part => part === '..' || part === '.'))) throw new Error('Use a relative folder path without dot segments.');
  if (!token.trim()) throw new Error('Enter a GitHub token for this session.');
  const request = (route: string) => githubRequest(token, `/repos/${repo}${route}`, 'GET', undefined, fetcher);
  const repository = await request('');
  const baseBranch = repository.default_branch;
  const branch = await request(`/branches/${encodeURIComponent(baseBranch)}`);
  const baseSha = branch.commit.sha;
  const commit = await request(`/git/commits/${baseSha}`);
  const tree = await request(`/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw new Error('Repository tree is too large to review safely.');
  const entries = new Map<string, string>(tree.tree.filter((entry: any) => entry.type === 'blob').map((entry: any) => [entry.path, entry.sha]));
  const changes: GitReview['changes'] = [];
  for (const [name, content] of Object.entries(files)) {
    const path = [folder.replace(/^\/+|\/+$/g, ''), name].filter(Boolean).join('/');
    const data = new TextEncoder().encode(content);
    const header = new TextEncoder().encode(`blob ${data.length}\0`);
    const bytes = new Uint8Array(header.length + data.length); bytes.set(header); bytes.set(data, header.length);
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)), n => n.toString(16).padStart(2, '0')).join('');
    if (entries.get(path) !== sha) changes.push({ path, content, previousSha: entries.get(path) });
  }
  return { repo, baseBranch, baseSha, treeSha: commit.tree.sha, changes };
}
export async function createGitHubBranch(review: GitReview, token: string, branch: string, fetcher: typeof fetch = fetch) {
  if (!/^[\w/-]+$/.test(branch) || branch.includes('..') || branch.endsWith('/') || branch.startsWith('/') || branch.includes('//') || branch === review.baseBranch) throw new Error('Choose a new branch name (letters, numbers, dashes and slashes).');
  if (!review.changes.length) throw new Error('There are no changes to publish.');
  const route = `/repos/${review.repo}`;
  const latest = await githubRequest(token, `${route}/branches/${encodeURIComponent(review.baseBranch)}`, 'GET', undefined, fetcher);
  if (latest.commit.sha !== review.baseSha) throw new Error('The base branch changed. Review the changes again before publishing.');
  const tree = await githubRequest(token, `${route}/git/trees`, 'POST', { base_tree: review.treeSha, tree: review.changes.map(file => ({ path: file.path, mode: '100644', type: 'blob', content: file.content })) }, fetcher);
  const commit = await githubRequest(token, `${route}/git/commits`, 'POST', { message: 'Export Sketch2UI project', tree: tree.sha, parents: [review.baseSha] }, fetcher);
  await githubRequest(token, `${route}/git/refs`, 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha }, fetcher);
  return `https://github.com/${review.repo}/tree/${encodeURIComponent(branch)}`;
}
export async function createGitHubPR(review: GitReview, token: string, branch: string, fetcher: typeof fetch = fetch) {
  return githubRequest(token, `/repos/${review.repo}/pulls`, 'POST', { title: 'Export Sketch2UI project', head: branch, base: review.baseBranch, body: `Adds the exported React/Vite project (${review.changes.length} changed files).\n\nReview the generated UI and API contract before deploying. Existing unrelated files are retained.` }, fetcher);
}
