import type { Brand } from './brand';
import type { BrandAsset } from './brandAssets';

/**
 * Design-system builder (phase 2): one AI pass over the user's own brand
 * assets — logo and reference images by vision, guideline documents as
 * text, extracted palettes and uploaded font names as facts — returning a
 * complete DESIGN.md v2 token set. The model call is injected (`ask`) so
 * the studio's provider plumbing (and its usage accounting) is reused and
 * the assembly stays unit-testable.
 */
export type AskFn = (userText: string, system: string, images: string[]) => Promise<string>;

export const DESIGN_BUILD_SYSTEM = [
  'You are a senior brand designer inside Sketch2UI. Build a complete design system from the user\'s own brand assets: attached images (logos, screenshots, mood material), the guideline document texts, the measured color palettes, and the uploaded font names provided below.',
  'Reply with ONLY a JSON object, no explanations, no markdown fences, with exactly these keys:',
  '{"name": string, "primary": "#rrggbb", "secondary": "#rrggbb", "background": "#rrggbb", "text": "#rrggbb", "surface": "#rrggbb", "muted": "#rrggbb", "success": "#rrggbb", "warning": "#rrggbb", "danger": "#rrggbb", "font": string, "displayFont": string, "radius": number, "language": "ar"|"en", "voice": string, "rules": [string, ...]}',
  'Decisions:',
  '- Colors come from the attached images and the measured palettes — harmonize them into the roles above; keep text readable on background (WCAG-minded contrast).',
  '- language: "ar" when the documents and brand material are predominantly Arabic, otherwise "en".',
  '- font / displayFont: prefer families from the uploaded font list or named in the documents; otherwise a widely available stack (e.g. "system-ui", "Georgia"). displayFont may equal font.',
  '- voice: ONE short sentence describing the tone of copy, written in the brand\'s language.',
  '- rules: up to 5 short do/don\'t rules for applying this identity, in the brand\'s language.',
  '- radius: a corner radius in px (0-40) matching the shapes in the images.',
].join('\n');

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function hex(value: unknown): string | undefined {
  if (typeof value !== 'string' || !HEX_RE.test(value.trim())) return undefined;
  let h = value.trim().slice(1).toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

/** Parse the builder's JSON reply into brand fields; unknown or invalid values are dropped, never guessed. */
export function parseDesignBuild(text: string): Partial<Brand> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The design-system builder did not return a usable result. Try again.');
  let j: Record<string, unknown>;
  try { j = JSON.parse(text.slice(start, end + 1)); } catch { throw new Error('The design-system builder did not return a usable result. Try again.'); }
  const out: Partial<Brand> = {};
  if (typeof j.name === 'string' && j.name.trim()) out.name = j.name.trim().slice(0, 80);
  for (const key of ['primary', 'secondary', 'background', 'text', 'surface', 'muted', 'success', 'warning', 'danger'] as const) {
    const v = hex(j[key]);
    if (v) out[key] = v;
  }
  if (typeof j.font === 'string' && j.font.trim()) out.font = j.font.trim().slice(0, 60);
  if (typeof j.displayFont === 'string') out.displayFont = j.displayFont.trim().slice(0, 60);
  if (typeof j.radius === 'number' && Number.isFinite(j.radius)) out.radius = Math.max(0, Math.min(80, Math.round(j.radius)));
  if (j.language === 'ar' || j.language === 'en') out.language = j.language;
  if (typeof j.voice === 'string' && j.voice.trim()) out.voice = j.voice.trim().slice(0, 200);
  return out;
}

export interface DesignBuildInput {
  images: string[];
  userText: string;
  docCount: number;
}

/** Assemble the builder inputs from the asset library: logos first, at most 4 images; documents capped. */
export function designBuildInput(assets: BrandAsset[]): DesignBuildInput {
  const images = [...assets.filter((a) => a.kind === 'logo' && a.dataUrl), ...assets.filter((a) => a.kind === 'image' && a.dataUrl)]
    .slice(0, 4).map((a) => a.dataUrl as string);
  const docs = assets.filter((a) => a.kind === 'doc' && a.text);
  const palettes = assets.filter((a) => a.palette?.length)
    .map((a) => `- ${a.name}: ${a.palette!.join(', ')}`).join('\n');
  const fonts = assets.filter((a) => a.kind === 'font' && a.fontFamily).map((a) => a.fontFamily as string);
  const parts: string[] = [];
  if (palettes) parts.push(`## Measured palettes (from the images, exact)\n${palettes}`);
  if (fonts.length) parts.push(`## Uploaded font families\n${fonts.join(', ')}`);
  let budget = 8000;
  for (const doc of docs) {
    if (budget <= 0) break;
    const text = (doc.text as string).slice(0, budget);
    budget -= text.length;
    parts.push(`## Document: ${doc.name}\n${text}`);
  }
  if (!parts.length && !images.length) throw new Error('Add at least one image, logo or document first.');
  parts.push('Build the design system JSON now.');
  return { images, userText: parts.join('\n\n'), docCount: docs.length };
}

/** The majority language of the documents — the fallback when the model omits one. */
export function majorityDocLanguage(assets: BrandAsset[]): 'ar' | 'en' {
  let ar = 0, en = 0;
  for (const a of assets) {
    if (a.kind !== 'doc') continue;
    if (a.lang === 'ar') ar++;
    else if (a.lang === 'en') en++;
  }
  return ar > en ? 'ar' : 'en';
}

export async function buildDesignSystem(assets: BrandAsset[], ask: AskFn): Promise<Partial<Brand>> {
  const input = designBuildInput(assets);
  const reply = await ask(input.userText, DESIGN_BUILD_SYSTEM, input.images);
  const built = parseDesignBuild(reply);
  if (!built.language) built.language = majorityDocLanguage(assets);
  built.direction = built.language === 'ar' ? 'rtl' : 'ltr';
  return built;
}
