import { generate, segmentImageSam } from './providers';
import type { ProviderConfig } from '../types';

/** One segmented sketch element. Coordinates are relative to the image (0..1). */
export interface SegmentBox {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SegmentSource = 'sam-3.1' | 'vision';

export interface SegmentResult {
  boxes: SegmentBox[];
  source: SegmentSource;
}

export interface SegmentOverlayData extends SegmentResult {
  image: string;
}

const SAM_PROMPT = 'ui elements, rectangles, buttons, input fields, image placeholders, circles, text blocks';

const BOX_RE = /(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|>/g;

export interface SamParse {
  width: number;
  height: number;
  boxes: { id: string; x: number; y: number; w: number; h: number }[];
}

/**
 * Parses the SAM 3 protocol box tokens from a sam-3.1 output text lane.
 * Wire format (per frame line): <frame>id<|box;x1=..;y1=..;x2=..;y2=..;w=W;h=H|><|mask;...|>
 * Box corners and the frame size are source pixels. Mask payloads are ignored:
 * the element map and the overlay only need boxes.
 */
export function parseSamTokens(text: string): SamParse | null {
  if (!text) return null;
  BOX_RE.lastIndex = 0;
  const boxes: SamParse['boxes'] = [];
  let width = 0;
  let height = 0;
  let m: RegExpExecArray | null;
  while ((m = BOX_RE.exec(text))) {
    const [, id, x1, y1, x2, y2, w, h] = m;
    width = Math.max(width, Number(w));
    height = Math.max(height, Number(h));
    boxes.push({ id, x: Number(x1), y: Number(y1), w: Number(x2) - Number(x1), h: Number(y2) - Number(y1) });
  }
  if (!boxes.length || width <= 0 || height <= 0) return null;
  return { width, height, boxes };
}

const clamp1000 = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1000, n)) : 0;
};

/** Parses the vision fallback reply: a JSON object with elements in 0..1000 space. */
export function parseVisionElements(text: string): { label: string; x: number; y: number; w: number; h: number }[] | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(text.slice(start, end + 1));
    const list = Array.isArray(j?.elements) ? j.elements : Array.isArray(j) ? j : [];
    const out = list
      .filter((e: any) => e && typeof e === 'object')
      .map((e: any) => ({
        label: String(e.label || 'element').slice(0, 40),
        x: clamp1000(e.x),
        y: clamp1000(e.y),
        w: clamp1000(e.w),
        h: clamp1000(e.h),
      }))
      .filter((e: any) => e.w > 0 && e.h > 0)
      .slice(0, 40);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Formats the element map appended to the generation prompt (0..1000 space). */
export function formatElementMap(boxes: SegmentBox[], source: SegmentSource): string {
  const lines = boxes.map(
    (b, i) => `${i + 1}. ${b.label} - x=${Math.round(b.x * 1000)}, y=${Math.round(b.y * 1000)}, w=${Math.round(b.w * 1000)}, h=${Math.round(b.h * 1000)}`,
  );
  return `SKETCH ELEMENT MAP (from a ${source === 'sam-3.1' ? 'SAM 3.1 segmentation' : 'vision segmentation'} pre-pass; coordinates are relative to the sketch, 0-1000). Use it to place elements faithfully:\n${lines.join('\n')}`;
}

const VISION_SYSTEM = 'You are a precise wireframe layout analyzer. Reply with JSON only, no explanations.';
const VISION_INSTRUCTION =
  'List every distinct UI element in this wireframe sketch (rectangles, buttons, inputs, text blocks, image placeholders, circles/avatars, charts, tables). Reply with ONLY a JSON object: {"elements":[{"label":"header","x":120,"y":60,"w":760,"h":120}]} using coordinates in a 0-1000 space relative to the image size.';

/**
 * Segmentation pre-pass for a sketch image. On the Meta Model API it first
 * tries SAM 3.1 (Responses surface, SAM 3 protocol tokens). If SAM is
 * unavailable or returns nothing parseable, it falls back to the active
 * vision chat model returning structured boxes. The returned source field
 * records which engine actually produced the boxes. Never throws.
 */
export async function segmentSketch(
  provider: ProviderConfig,
  chatModel: string,
  imageDataUrl: string,
  signal?: AbortSignal,
): Promise<SegmentResult | null> {
  try {
    if (provider.type === 'meta') {
      const raw = await segmentImageSam(provider, imageDataUrl, SAM_PROMPT, signal);
      const parsed = raw ? parseSamTokens(raw) : null;
      if (parsed) {
        return {
          source: 'sam-3.1',
          boxes: parsed.boxes.map((b) => ({
            label: `element ${b.id}`,
            x: b.x / parsed.width,
            y: b.y / parsed.height,
            w: b.w / parsed.width,
            h: b.h / parsed.height,
          })),
        };
      }
    }
    const text = await generate({
      provider,
      model: chatModel,
      system: VISION_SYSTEM,
      userText: VISION_INSTRUCTION,
      imageDataUrls: [imageDataUrl],
      temperature: 0,
      signal: signal ?? new AbortController().signal,
      onToken: () => {},
    });
    const elements = parseVisionElements(text);
    if (!elements) return null;
    return {
      source: 'vision',
      boxes: elements.map((e) => ({ label: e.label, x: e.x / 1000, y: e.y / 1000, w: e.w / 1000, h: e.h / 1000 })),
    };
  } catch {
    return null;
  }
}
