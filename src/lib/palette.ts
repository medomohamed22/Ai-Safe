/**
 * Dominant-color extraction for brand assets. The core is a pure bucket
 * quantizer over RGB samples (unit-testable); the browser glue samples a
 * downscaled canvas. No AI involved — the palette appears instantly and
 * can seed the brand colors before any model call.
 */
export function dominantColors(samples: ArrayLike<number>, count = 5): string[] {
  interface Bucket { n: number; r: number; g: number; b: number }
  const buckets = new Map<number, Bucket>();
  for (let i = 0; i + 2 < samples.length; i += 3) {
    const r = samples[i], g = samples[i + 1], b = samples[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n)
    .map((b) => ({ n: b.n, r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n) }));
  const picked: { r: number; g: number; b: number }[] = [];
  for (const c of sorted) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < 48)) continue;
    picked.push(c);
  }
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return picked.map((c) => `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`);
}

/** Sample an image data URL on a small canvas and return its dominant colors. */
export async function paletteFromImage(dataUrl: string, count = 5): Promise<string[]> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('image')); img.src = dataUrl; });
    const side = 48;
    const canvas = document.createElement('canvas');
    canvas.width = side; canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, side, side);
    const data = ctx.getImageData(0, 0, side, side).data;
    const samples: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue; // skip (near-)transparent pixels
      samples.push(data[i], data[i + 1], data[i + 2]);
    }
    return dominantColors(samples, count);
  } catch {
    return [];
  }
}

/** Relative luminance of a #rrggbb color, 0 (black) to 1 (white). */
export function luminance(hexColor: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexColor.trim());
  if (!m) return 0.5;
  const v = parseInt(m[1], 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
