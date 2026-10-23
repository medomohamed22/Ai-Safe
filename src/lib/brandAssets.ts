import { friendlyStorageError } from './workspaces';

/**
 * Brand asset library (design-system expansion, phase 1): the raw material
 * of the user's design system — images, logos, guideline documents and font
 * files — stored locally in IndexedDB next to the workspaces database.
 * Nothing leaves the browser from here; later phases hand selected assets
 * to the user's own AI provider when building the design system.
 */
export type BrandAssetKind = 'image' | 'logo' | 'doc' | 'font';
export type TextLanguage = 'ar' | 'en' | 'mixed';

export interface BrandAsset {
  id: string;
  kind: BrandAssetKind;
  name: string;
  mime: string;
  size: number;
  addedAt: number;
  dataUrl?: string;
  text?: string;
  lang?: TextLanguage;
  palette?: string[];
  fontFamily?: string;
}

export const ASSET_COUNT_LIMIT = 24;
const SIZE_LIMITS: Record<BrandAssetKind, number> = {
  image: 2 * 1024 * 1024,
  logo: 2 * 1024 * 1024,
  doc: 256 * 1024,
  font: 2 * 1024 * 1024,
};

export function validateAssetFile(kind: BrandAssetKind, file: { name: string; size: number; type: string }): string {
  if (file.size > SIZE_LIMITS[kind]) {
    return kind === 'doc' ? 'Documents can be up to 256 KB.' : 'Files can be up to 2 MB.';
  }
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const ok =
    kind === 'image' ? ['image/png', 'image/jpeg', 'image/webp'].includes(type)
    : kind === 'logo' ? ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(type) || name.endsWith('.svg')
    : kind === 'doc' ? /\.(md|markdown|txt)$/.test(name) || type.startsWith('text/')
    : /\.(woff2|woff|ttf|otf)$/.test(name) || type.includes('font');
  return ok ? '' : 'Unsupported file type for this asset.';
}

/** Arabic vs Latin letter balance of a document — drives the design system's content language. */
export function detectTextLanguage(text: string): TextLanguage {
  let ar = 0, en = 0;
  for (const ch of text) {
    if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(ch)) ar++;
    else if (/[a-zA-Z]/.test(ch)) en++;
  }
  if (ar + en === 0) return 'mixed';
  if (ar / (ar + en) > 0.6) return 'ar';
  if (en / (ar + en) > 0.6) return 'en';
  return 'mixed';
}

/** "Cairo-Bold.woff2" -> "Cairo Bold" — the family name we register and offer. */
export function fontFamilyFromName(name: string): string {
  return name.replace(/\.(woff2|woff|ttf|otf)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Custom font';
}

export function newAssetId(): string {
  try { return crypto.randomUUID(); } catch { return `asset-${Date.now()}-${Math.floor(Math.random() * 1e6)}`; }
}

let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('sketch2ui-brand-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
  return database;
}

function request<T>(run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((handle) => new Promise<T>((resolve, reject) => {
    const req = run(handle.transaction('assets', 'readwrite').objectStore('assets'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  })).catch((e) => { throw new Error(friendlyStorageError(e)); });
}

export async function listBrandAssets(): Promise<BrandAsset[]> {
  const all = await request<BrandAsset[]>((store) => store.getAll() as IDBRequest<BrandAsset[]>);
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function addBrandAsset(asset: BrandAsset, currentCount: number): Promise<void> {
  if (currentCount >= ASSET_COUNT_LIMIT) throw new Error('The asset library is full (24 files).');
  await request((store) => store.put(asset));
}

export async function removeBrandAsset(id: string): Promise<void> {
  await request((store) => store.delete(id));
}
