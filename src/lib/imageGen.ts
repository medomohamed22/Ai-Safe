import { generateImage } from './providers';
import type { ProviderConfig } from '../types';

/** Placeholder image services the model is instructed to use (see prompts.ts). */
const PLACEHOLDER_RE = /https?:\/\/(?:picsum\.photos|placehold\.co|via\.placeholder\.com|dummyimage\.com|placeholder\.com)[^\s"'`)]*/g;

export const MAX_GENERATED_IMAGES = 4;
// Demo guardrail (item 9): the hosted demo generates fewer images per design,
// so the shared credit lasts; a visitor's own key keeps the full quality.
export const DEMO_MAX_GENERATED_IMAGES = 2;

export interface ImageSlot {
  url: string;
  prompt: string;
}

function promptFromAlt(alt: string | undefined, url: string): string {
  const clean = (alt || '').replace(/\s+/g, ' ').trim();
  if (clean.length >= 4 && !/^(image|photo|picture|placeholder|img)$/i.test(clean)) {
    return `Photorealistic image: ${clean.slice(0, 160)}`;
  }
  const seed = url.match(/\/seed\/([^/]+)/)?.[1];
  if (seed) return `Photorealistic image related to ${decodeURIComponent(seed).replace(/[-_+]+/g, ' ').slice(0, 120)}, high quality`;
  return 'Photorealistic lifestyle image, modern, high quality';
}

/** Finds placeholder image URLs in generated code and derives a prompt for each. */
export function findImageSlots(code: string): ImageSlot[] {
  const byUrl = new Map<string, string>();
  const imgTagRe = /<img\b[^>]*>/gi;
  let tag: RegExpExecArray | null;
  while ((tag = imgTagRe.exec(code))) {
    const src = tag[0].match(/src\s*=\s*["']([^"']+)["']/)?.[1];
    if (!src) continue;
    PLACEHOLDER_RE.lastIndex = 0;
    if (!PLACEHOLDER_RE.test(src)) continue;
    const alt = tag[0].match(/alt\s*=\s*["']([^"']*)["']/)?.[1];
    if (!byUrl.has(src)) byUrl.set(src, promptFromAlt(alt, src));
  }
  PLACEHOLDER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(code))) {
    if (!byUrl.has(m[0])) byUrl.set(m[0], promptFromAlt(undefined, m[0]));
  }
  return [...byUrl.entries()].map(([url, prompt]) => ({ url, prompt }));
}

/** Which image model to call for a provider, or null when it cannot generate images. */
export function imageModelFor(provider: ProviderConfig): string | null {
  if (provider.type === 'gemini') return null;
  if (provider.type === 'meta') return 'muse-image-1.0';
  const found = provider.models.find((m) => /dall-e|gpt-image|flux|imagen|stable-diffusion|sd-|image/i.test(m.id) && !/vision|embed/i.test(m.id));
  return found?.id ?? null;
}

/** Replaces placeholder URLs in code with generated image sources. */
export function applyImages(code: string, replacements: ReadonlyMap<string, string>): string {
  let out = code;
  for (const [url, replacement] of replacements) out = out.split(url).join(replacement);
  return out;
}

async function shrinkDataUrl(dataUrl: string, maxSide = 896): Promise<string> {
  try {
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return dataUrl;
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    try {
      if (Math.max(bitmap.width, bitmap.height) <= maxSide) return dataUrl;
      const scale = maxSide / Math.max(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return dataUrl;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      bitmap.close();
    }
  } catch {
    return dataUrl;
  }
}

/**
 * Post-generation pass: swaps placeholder image URLs in the code for real
 * AI-generated images (provider images endpoint; Muse Image on Meta). Any
 * failure leaves the original placeholder in place. Returns the code unchanged
 * when the provider cannot generate images or no placeholders are present.
 */
export async function enhanceCodeWithImages(code: string, provider: ProviderConfig, signal?: AbortSignal): Promise<string> {
  const model = imageModelFor(provider);
  if (!model) return code;
  const slots = findImageSlots(code).slice(0, provider.demo ? DEMO_MAX_GENERATED_IMAGES : MAX_GENERATED_IMAGES);
  if (!slots.length) return code;
  const replacements = new Map<string, string>();
  for (const slot of slots) {
    if (signal?.aborted) break;
    const image = await generateImage(provider, model, slot.prompt, signal);
    if (!image) continue;
    replacements.set(slot.url, image.startsWith('data:') ? await shrinkDataUrl(image) : image);
  }
  return replacements.size ? applyImages(code, replacements) : code;
}
