import type { Brand } from './brand';
import { normalizeBrand } from './brand';
import type { BrandAsset } from './brandAssets';
import { buildFontFaceCss } from './brandAssets';
import { luminance } from './palette';

// Design-system polish (phase 5): pull a starting identity from a live
// website, move a whole design system between workspaces as one file, render
// a shareable brand board, and export W3C-style design tokens.

export interface SiteBrand { name: string; colors: string[]; fonts: string[] }

const GENERIC_FONTS = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit', 'initial', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont', 'roboto', 'arial', 'helvetica', 'helvetica neue', 'georgia', 'tahoma', 'verdana', 'times new roman']);

function normalizeHex(raw: string): string | null {
  let hex = raw.replace('#', '').toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(hex)) return null;
  return `#${hex}`;
}

/** Pull a site's identity out of its HTML: the theme-color and most-used
 *  colors first (chromatic colors ranked ahead of neutrals), the page title
 *  as the brand name, and the named font families it loads or declares. */
export function extractSiteBrand(html: string): SiteBrand {
  const title = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(html)?.[1]?.trim().replace(/\s+/g, ' ') || '';
  const name = title.split(/[|·—–-]/)[0].trim();
  const theme = /<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8})["']/i.exec(html)?.[1]
    || /<meta[^>]+content=["'](#[0-9a-fA-F]{3,8})["'][^>]+name=["']theme-color["']/i.exec(html)?.[1];
  const hexes = [...html.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => normalizeHex(m[0])).filter((h): h is string => !!h);
  const frequency = new Map<string, number>();
  for (const h of hexes) frequency.set(h, (frequency.get(h) || 0) + 1);
  const ranked = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([hex]) => hex);
  const themeHex = theme ? normalizeHex(theme) : null;
  const colors: string[] = [];
  if (themeHex) colors.push(themeHex);
  // Chromatic colors carry the identity; neutrals fill the remaining slots.
  const chromatic = ranked.filter((c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return Math.max(r, g, b) - Math.min(r, g, b) > 24; });
  const neutral = ranked.filter((c) => !chromatic.includes(c));
  for (const c of [...chromatic, ...neutral]) if (!colors.includes(c) && colors.length < 8) colors.push(c);
  const fonts = new Set<string>();
  for (const m of html.matchAll(/family=([A-Za-z0-9+ ]+)/g)) fonts.add(m[1].replace(/\+/g, ' ').split(':')[0].trim());
  for (const m of html.matchAll(/font-family\s*:\s*([^;}]{1,120})/gi)) {
    for (const part of m[1].split(',')) {
      const f = part.trim().replace(/^["']|["']$/g, '');
      if (f && !GENERIC_FONTS.has(f.toLowerCase())) fonts.add(f);
    }
  }
  return { name, colors, fonts: [...fonts].slice(0, 6) };
}

/** Map an extracted site palette onto the brand color roles. */
export function siteBrandPatch(site: SiteBrand): Partial<Brand> {
  const patch: Partial<Brand> = {};
  if (site.name) patch.name = site.name;
  if (site.colors.length) {
    const byLight = [...site.colors].sort((a, b) => luminance(a) - luminance(b));
    patch.primary = site.colors[0];
    if (site.colors[1]) patch.secondary = site.colors[1];
    patch.text = byLight[0];
    patch.background = byLight[byLight.length - 1];
    if (byLight.length > 2) patch.surface = byLight[byLight.length - 2];
  }
  if (site.fonts.length) { patch.font = site.fonts[0]; patch.displayFont = site.fonts[0]; }
  return patch;
}

/** Fetch a public page through the app proxy and extract its identity. */
export async function importBrandFromUrl(rawUrl: string): Promise<SiteBrand> {
  let url: URL;
  try { url = new URL(rawUrl.trim()); } catch { throw new Error('Enter a valid website address first.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https addresses can be imported.');
  let response: Response;
  try { response = await fetch(`/api/proxy?url=${encodeURIComponent(url.toString())}`); }
  catch { throw new Error('Could not reach that site from here — check the address and try again.'); }
  if (!response.ok) throw new Error('Could not read that site (it answered {0}).'.replace('{0}', String(response.status)));
  const html = await response.text();
  const site = extractSiteBrand(html);
  if (!site.colors.length && !site.fonts.length) throw new Error('No colors or fonts could be read from that page.');
  return site;
}

// ---- Design tokens ----

/** A W3C-design-tokens-shaped export of the brand, for handoff to other
 *  tools (Figma Tokens, Style Dictionary). */
export function designTokens(brand: Brand): Record<string, unknown> {
  const color = (value: string) => ({ $type: 'color', $value: value });
  const b = normalizeBrand(brand);
  return {
    $metadata: { name: b.name || 'Sketch2UI brand', generator: 'Sketch2UI design system' },
    color: {
      primary: color(b.primary), secondary: color(b.secondary), background: color(b.background), surface: color(b.surface),
      text: color(b.text), muted: color(b.muted), success: color(b.success), warning: color(b.warning), danger: color(b.danger),
    },
    fontFamily: { body: { $type: 'fontFamily', $value: b.font }, display: { $type: 'fontFamily', $value: b.displayFont || b.font } },
    borderRadius: { base: { $type: 'dimension', $value: `${b.radius}px` } },
    content: { language: { $type: 'string', $value: b.language }, direction: { $type: 'string', $value: b.direction }, voice: { $type: 'string', $value: b.voice } },
  };
}

// ---- Whole-system export / import ----

export interface DesignSystemFile { format: 'sketch2ui-design-system'; version: 1; brand: Brand; assets: BrandAsset[] }

export function serializeDesignSystem(brand: Brand, assets: BrandAsset[]): string {
  return JSON.stringify({ format: 'sketch2ui-design-system', version: 1, brand: normalizeBrand(brand), assets } satisfies DesignSystemFile, null, 2);
}

export function parseDesignSystemFile(text: string): DesignSystemFile {
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file is not a Sketch2UI design system.'); }
  if (!parsed || parsed.format !== 'sketch2ui-design-system' || !parsed.brand) throw new Error('That file is not a Sketch2UI design system.');
  const assets = Array.isArray(parsed.assets) ? parsed.assets.filter((a: any) => a && typeof a.id === 'string' && typeof a.name === 'string' && ['image', 'logo', 'doc', 'font'].includes(a.kind)) : [];
  return { format: 'sketch2ui-design-system', version: 1, brand: normalizeBrand(parsed.brand), assets };
}

// ---- Brand board ----

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A standalone, printable brand-board page: identity, palette, type,
 *  voice and the uploaded assets. */
export function brandBoardHtml(brand: Brand, assets: BrandAsset[]): string {
  const b = normalizeBrand(brand);
  const roles: Array<[string, string]> = [['Primary', b.primary], ['Secondary', b.secondary], ['Background', b.background], ['Surface', b.surface], ['Text', b.text], ['Muted', b.muted], ['Success', b.success], ['Warning', b.warning], ['Danger', b.danger]];
  const swatches = roles.map(([label, hex]) => `<div class="sw"><div class="chip" style="background:${hex}"></div><strong>${label}</strong><span>${hex}</span></div>`).join('');
  const fontCss = buildFontFaceCss(assets, [...new Set(assets.filter((a) => a.kind === 'font' && a.fontFamily).map((a) => a.fontFamily as string))]);
  const thumbs = assets.filter((a) => (a.kind === 'image' || a.kind === 'logo') && a.dataUrl).map((a) => `<figure><img src="${a.dataUrl}" alt="${esc(a.name)}"><figcaption>${esc(a.name)}</figcaption></figure>`).join('');
  const docs = assets.filter((a) => a.kind === 'doc').map((a) => `<li>${esc(a.name)}${a.lang ? ` · ${a.lang === 'ar' ? 'Arabic' : a.lang === 'en' ? 'English' : 'Mixed'}` : ''}</li>`).join('');
  return `<!doctype html>
<html lang="${b.language === 'ar' ? 'ar' : 'en'}" dir="${b.direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(b.name || 'Brand')} — brand board</title>
<style>${fontCss}
body{font-family:${esc(b.font)},system-ui,sans-serif;background:${b.background};color:${b.text};margin:0;padding:32px;line-height:1.5}
main{max-width:880px;margin:0 auto}h1{font-family:${esc(b.displayFont || b.font)},${esc(b.font)},sans-serif;font-size:40px;margin:0 0 4px}
.sub{opacity:.75;margin:0 0 28px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin:12px 0 28px}
.sw{background:${b.surface};border-radius:${b.radius}px;padding:10px}.sw .chip{height:56px;border-radius:${Math.max(4, b.radius - 4)}px;margin-bottom:8px;border:1px solid rgba(0,0,0,.08)}
.sw strong{display:block;font-size:13px}.sw span{font-size:12px;opacity:.7}
.specimen{background:${b.surface};border-radius:${b.radius}px;padding:20px;margin:12px 0 28px}
.specimen .display{font-family:${esc(b.displayFont || b.font)},${esc(b.font)},sans-serif;font-size:30px;font-weight:700}
.assets{display:flex;flex-wrap:wrap;gap:14px}.assets figure{margin:0;width:150px}.assets img{width:150px;height:110px;object-fit:contain;background:${b.surface};border-radius:${b.radius}px}
.assets figcaption{font-size:12px;opacity:.75;margin-top:4px;word-break:break-all}
button{position:fixed;top:16px;inset-inline-end:16px;background:${b.primary};color:#fff;border:0;border-radius:${b.radius}px;padding:10px 16px;cursor:pointer}
@media print{button{display:none}body{padding:12px}}
</style></head>
<body><button onclick="window.print()">Print / save as PDF</button><main>
<h1>${esc(b.name || 'Your brand')}</h1>
<p class="sub">Brand board · radius ${b.radius}px · content language ${b.language === 'auto' ? 'automatic' : b.language === 'ar' ? 'Arabic' : 'English'} · direction ${b.direction.toUpperCase()}</p>
<h2>Colors</h2><div class="grid">${swatches}</div>
<h2>Type</h2><div class="specimen"><div class="display">Aa — ${esc(b.displayFont || b.font)}</div><p>Body font: ${esc(b.font)}. The quick brown fox jumps over the lazy dog. الجمل الشائع لاختبار الخطوط العربية يظهر هنا بوضوح.</p></div>
${b.voice ? `<h2>Voice</h2><p>${esc(b.voice)}</p>` : ''}
${thumbs ? `<h2>Logos & images</h2><div class="assets">${thumbs}</div>` : ''}
${docs ? `<h2>Documents</h2><ul>${docs}</ul>` : ''}
</main></body></html>`;
}
