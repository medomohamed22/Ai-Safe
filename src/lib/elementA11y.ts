import type { ElementEdit } from './visualEdit';

// Element-level accessibility checks for the inspector (item 38). These run
// locally on the selected element's source — no model call. A check only
// claims what the source can prove: when a value is not explicit in the
// element (inherited colors, padding-based sizing), the status is 'unknown'
// rather than a fabricated pass. Fixes go through the existing direct-edit
// path (applyElementEdit), so they are instant and verified like any edit.

export interface A11yCheck {
  id: 'contrast' | 'name' | 'target';
  label: string;
  status: 'pass' | 'warn' | 'unknown';
  detailKey: string;
  detailArgs?: (string | number)[];
  fix?: ElementEdit;
  fixLabel?: string;
  agentHint?: string;
}

function rgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string): number | null {
  const ca = rgb(a);
  const cb = rgb(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Extract the text a sighted user would read: walk the snippet skipping
// tags (respecting quoted attributes and {...} expressions inside them,
// e.g. onClick={() => ...} whose => would defeat a naive tag regex) and
// expression children — except string-literal expressions, which ARE text.
function visibleTextOf(snippet: string): string {
  const skipExpression = (start: number): { end: number; literal?: string } => {
    let depth = 0;
    let i = start;
    while (i < snippet.length) {
      if (snippet[i] === '{') depth++;
      else if (snippet[i] === '}') { depth--; if (depth === 0) { i++; break; } }
      i++;
    }
    const inner = snippet.slice(start, i);
    const lit = inner.match(/^\{\s*(['"])((?:(?!\1).)*)\1\s*\}$/s);
    return { end: i, literal: lit ? lit[2] : undefined };
  };
  let out = '';
  let i = 0;
  while (i < snippet.length) {
    const ch = snippet[i];
    if (ch === '<') {
      i++;
      let quote = '';
      while (i < snippet.length) {
        const c = snippet[i];
        if (quote) { if (c === quote) quote = ''; i++; }
        else if (c === '"' || c === "'") { quote = c; i++; }
        else if (c === '{') { i = skipExpression(i).end; }
        else if (c === '>') { i++; break; }
        else i++;
      }
    } else if (ch === '{') {
      const r = skipExpression(i);
      if (r.literal) out += ' ' + r.literal;
      i = r.end;
    } else { out += ch; i++; }
  }
  return out.replace(/\s+/g, ' ').trim();
}

const styleColor = (snippet: string, prop: string) => snippet.match(new RegExp(`(?:^|[{,\\s])${prop}:\\s*["'](#[0-9a-fA-F]{6})["']`))?.[1];
const classColor = (snippet: string, prefix: string) => snippet.match(new RegExp(`${prefix}-\\[(#[0-9a-fA-F]{6})\\]`))?.[1];
const styleSize = (snippet: string, prop: string) => { const m = snippet.match(new RegExp(`(?:^|[{,\\s])${prop}:\\s*(\\d+)`)); return m ? Number(m[1]) : undefined; };

export function elementA11yChecks(snippet: string, tag: string): A11yCheck[] {
  const checks: A11yCheck[] = [];
  const interactive = tag === 'button' || tag === 'a' || /onClick|role=["']button["']/.test(snippet);

  // Contrast: the element's own text color against its own background
  // (or the page's white when it sets no background of its own).
  const fg = styleColor(snippet, 'color') || classColor(snippet, 'text');
  const bg = styleColor(snippet, 'backgroundColor') || classColor(snippet, 'bg') || '#ffffff';
  if (fg) {
    const ratio = contrastRatio(fg, bg);
    if (ratio !== null && ratio >= 4.5) checks.push({ id: 'contrast', label: 'Text contrast', status: 'pass', detailKey: 'Contrast {0}:1 — readable', detailArgs: [ratio.toFixed(1)] });
    else if (ratio !== null) {
      const onBlack = contrastRatio('#000000', bg) ?? 0;
      const onWhite = contrastRatio('#ffffff', bg) ?? 0;
      const fixColor = onBlack >= onWhite ? '#000000' : '#ffffff';
      checks.push({ id: 'contrast', label: 'Text contrast', status: 'warn', detailKey: 'Contrast {0}:1 — below the 4.5:1 minimum', detailArgs: [ratio.toFixed(1)], fix: { color: fixColor }, fixLabel: 'Fix contrast' });
    } else checks.push({ id: 'contrast', label: 'Text contrast', status: 'unknown', detailKey: 'No explicit text color to measure.' });
  } else checks.push({ id: 'contrast', label: 'Text contrast', status: 'unknown', detailKey: 'No explicit text color to measure.' });

  // Accessible name for interactive elements: visible text or an aria-label.
  if (interactive) {
    const visibleText = visibleTextOf(snippet);
    if (visibleText || /aria-label/.test(snippet)) checks.push({ id: 'name', label: 'Accessible name', status: 'pass', detailKey: 'Has visible text or an aria-label.' });
    else checks.push({ id: 'name', label: 'Accessible name', status: 'warn', detailKey: 'No text and no aria-label — screen readers cannot name it.', agentHint: 'Add an aria-label that describes what this element does' });
  }

  // Tap target: only provable when the element sets an explicit size.
  if (interactive) {
    const w = styleSize(snippet, 'width');
    const h = styleSize(snippet, 'height');
    if (w === undefined && h === undefined) checks.push({ id: 'target', label: 'Tap target', status: 'unknown', detailKey: 'No explicit size to measure.' });
    else if ((w !== undefined && w < 40) || (h !== undefined && h < 40)) {
      const fix: ElementEdit = {};
      if (w !== undefined && w < 40) fix.width = 40;
      if (h !== undefined && h < 40) fix.height = 40;
      checks.push({ id: 'target', label: 'Tap target', status: 'warn', detailKey: 'Smaller than 40px — hard to tap on a phone.', fix, fixLabel: 'Enlarge to 40px' });
    } else checks.push({ id: 'target', label: 'Tap target', status: 'pass', detailKey: 'At least 40px in both dimensions.' });
  }
  return checks;
}
