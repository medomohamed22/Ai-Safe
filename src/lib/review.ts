import { materializeLibrary } from './componentLibrary';
import { materializeAssets } from './designAssets';
import { instrumentPreview } from './visualEdit';
import { screenCode, type ScreenProject } from './screens';
import type { BackendConfig } from './backend';
export interface ReviewBundle { version: 1; preInstrumented?: boolean; activeId: string; screens: { id: string; name: string; code: string }[]; backend: BackendConfig }
export interface ReviewComment { id: string; screenId: string; elementId: number; text: string; author: string; createdAt: string }
export function reviewBundle(project: ScreenProject, backend: BackendConfig): ReviewBundle {
  const preInstrumented = project.screens.some(s => /@sketch2ui\/library|s2ui-asset:/.test(screenCode(s)));
  return { version: 1, ...(preInstrumented ? {preInstrumented:true} : {}), activeId: project.activeId, screens: project.screens.map(s => ({ id: s.id, name: s.name, code: preInstrumented ? materializeAssets(materializeLibrary(instrumentPreview(screenCode(s)))) : screenCode(s) })), backend: { mode: 'demo', baseUrl: '', endpoints: backend.endpoints.map(e => ({ id: e.id, method: e.method, path: e.path, dataPath: e.dataPath, fields: e.fields })) } };
}
export async function reviewId(bundle: ReviewBundle) {
  const data = new TextEncoder().encode(JSON.stringify({ screens: bundle.screens, backend: bundle.backend, preInstrumented: bundle.preInstrumented }));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), n => n.toString(16).padStart(2, '0')).join('');
}
export async function encodeReview(bundle: ReviewBundle) {
  const json = JSON.stringify(bundle);
  if (json.length > 1000000) throw new Error('Review source exceeds the 1 MB limit.');
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (encoded.length > 60000) throw new Error('This project is too large for a review link (60 KB encoded limit). Share a smaller screen/project or use the project ZIP.');
  return encoded;
}
export async function decodeReview(encoded: string): Promise<ReviewBundle> {
  if (encoded.length > 60000 || !/^[\w-]+$/.test(encoded)) throw new Error('Invalid or oversized review link.');
  const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 1000000) { await reader.cancel(); throw new Error('Decompressed review exceeds the 1 MB limit.'); } chunks.push(value); }
  const data = JSON.parse(await new Blob(chunks as BlobPart[]).text());
  if (data.version !== 1 || !Array.isArray(data.screens) || !data.screens.length || data.screens.length > 50 || data.screens.some((s: any) => typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.code !== 'string') || !data.backend || !Array.isArray(data.backend.endpoints)) throw new Error('Invalid review project.');
  // Never enable HTTP mode or carry a live backend URL from a shared link.
  data.backend.mode = 'demo'; data.backend.baseUrl = '';
  return data;
}
export function parseComments(text: string, expectedId: string): ReviewComment[] {
  if (text.length > 1000000) throw new Error('Comment file is too large.');
  const file = JSON.parse(text);
  if (file.reviewId !== expectedId) throw new Error('Comments belong to a different source snapshot. Open the matching code version first.');
  if (!Array.isArray(file.comments) || file.comments.length > 500 || file.comments.some((c: ReviewComment) => typeof c.id !== 'string' || typeof c.screenId !== 'string' || !Number.isInteger(c.elementId) || c.elementId < 0 || typeof c.text !== 'string' || c.text.length > 5000 || typeof c.author !== 'string' || typeof c.createdAt !== 'string')) throw new Error('Invalid comments file.');
  return file.comments;
}
export function downloadComments(id: string, comments: ReviewComment[]) {
  const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([JSON.stringify({ reviewId: id, comments }, null, 2)], { type: 'application/json' }));
  a.href = url; a.download = 'sketch2ui-review-comments.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
