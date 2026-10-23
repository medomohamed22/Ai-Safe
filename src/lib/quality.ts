import { parse } from '@babel/parser';
import type { ScenarioResult } from './interactionTests';
export function normalizeHex(value: string): string {
  let h = value.trim().toLowerCase();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9a-f]{3}$/.test(h)) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return h;
}

export interface BrandConformance { used: string[]; offPalette: string[] }

/**
 * Which chromatic hex colors in the code fall outside the brand palette.
 * Achromatic neutrals (grays, black, white) are ignored on purpose: they
 * are shading, not identity. This is a warning signal, never a blocker.
 */
export function brandConformance(code: string, palette: string[]): BrandConformance {
  const allowed = new Set(palette.map(normalizeHex));
  const used = new Set<string>();
  const off = new Set<string>();
  for (const m of code.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    const hex = normalizeHex(m[0]);
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (allowed.has(hex)) { used.add(hex); continue; }
    if (spread <= 10) continue;
    off.add(hex);
  }
  return { used: [...used], offPalette: [...off] };
}

export function sourceChecks(code: string): ScenarioResult[] {
 try {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const hasDefault = ast.program.body.some(n => n.type === 'ExportDefaultDeclaration');
  return [{ name: 'JSX syntax', passed: true, status: 'passed', detail: 'Parsed successfully; this is not a production bundle check.' }, { name: 'React entry point', passed: hasDefault, status: hasDefault ? 'passed' : 'failed', detail: hasDefault ? 'Default export found' : 'Missing default component export' }];
 } catch (e) { return [{ name: 'JSX syntax', passed: false, status: 'failed', detail: (e as Error).message }]; }
}
// Quality results grouped for action (P3-04): build, runtime, responsive,
// accessibility, and the user's own acceptance scenarios. Runtime rows are
// prefixed with the viewport width ("390px · Content clipping"), so the
// width is stripped before classifying; anything unrecognized is an
// acceptance-scenario row by construction (scenario names are free text).
export const QUALITY_GROUPS = ['Build', 'Runtime', 'Responsive', 'Accessibility', 'Acceptance scenarios'] as const;
export function qualityGroupOf(name: string): string {
 const base = name.replace(/^\d+px · /, '');
 if (['JSX syntax', 'React entry point', 'Production JavaScript bundle'].includes(base)) return 'Build';
 if (['Rendered content', 'Runtime errors', 'Runtime', 'Cancelled'].includes(base)) return 'Runtime';
 if (['Horizontal overflow', 'Content clipping', 'Fixed overlay coverage', 'Off-viewport actions'].includes(base)) return 'Responsive';
 if (['Button names', 'Form labels', 'Image alternatives'].includes(base)) return 'Accessibility';
 return 'Acceptance scenarios';
}
export function auditDocument(): ScenarioResult[] {
 const root = document.querySelector('#root');
 const rows: ScenarioResult[] = [];
 const add = (name: string, bad: string[]) => rows.push({ name, passed: !bad.length, status: !bad.length ? 'passed' : 'failed', detail: bad.length ? bad.slice(0, 6).join('; ') : 'Passed this check' });
 add('Rendered content', root?.children.length ? [] : ['No rendered app']);
 add('Horizontal overflow', document.documentElement.scrollWidth > innerWidth + 2 ? [`Content ${document.documentElement.scrollWidth}px exceeds ${innerWidth}px`] : []);
 const name = (e: Element) => e.getAttribute('aria-label')?.trim() || (e.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join('').trim() || e.getAttribute('title') || e.textContent?.trim();
 add('Button names', Array.from(root?.querySelectorAll('button') || []).filter(e => !name(e)).map(() => 'Button has no accessible name'));
 add('Form labels', Array.from(root?.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select') || []).filter(e => !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !(e as HTMLInputElement).labels?.length).map(e => `Unlabelled ${e.tagName.toLowerCase()}`));
 add('Image alternatives', Array.from(root?.querySelectorAll('img') || []).filter(e => !e.hasAttribute('alt') && e.getAttribute('role') !== 'presentation').map(() => 'Image missing alt'));
 // Geometric responsive checks (P1-04): page width alone passed designs
 // whose fixed sidebar crushed the content on a phone. These inspect the
 // rendered boxes instead — still heuristics, so each names what it saw.
 const describe = (e: Element) => { const el = e as HTMLElement; return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''}`; };
 const inScroller = (e: Element) => { let n: Element | null = e; while (n && n !== document.body) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; n = n.parentElement; } return false; };
 const clipped: string[] = [];
 root?.querySelectorAll('*').forEach(e => {
   const el = e as HTMLElement; if (!el.clientWidth || el.tagName === 'svg' || el.tagName === 'CANVAS') return;
   const cs = getComputedStyle(el);
   if (cs.display === 'none' || cs.visibility === 'hidden' || cs.textOverflow === 'ellipsis' || inScroller(el)) return;
   if (el.scrollWidth > el.clientWidth + 8) clipped.push(`${describe(el)} content ${el.scrollWidth}px in a ${el.clientWidth}px box`);
 });
 add('Content clipping', clipped);
 const fixed: string[] = [];
 if (innerWidth <= 480) root?.querySelectorAll('*').forEach(e => {
   const el = e as HTMLElement; const cs = getComputedStyle(el);
   if (cs.position !== 'fixed' || el.getAttribute('role') === 'dialog') return;
   const r = el.getBoundingClientRect();
   if (r.width > innerWidth * 0.45 && r.height > innerHeight * 0.5) fixed.push(`${describe(el)} is fixed and covers ${Math.round(r.width / innerWidth * 100)}% of the ${innerWidth}px viewport width`);
 });
 add('Fixed overlay coverage', fixed);
 const offscreen: string[] = [];
 root?.querySelectorAll('button, a[href], input, select, textarea').forEach(e => {
   const r = (e as HTMLElement).getBoundingClientRect();
   if (r.width && (r.right <= 0 || r.left >= innerWidth)) offscreen.push(`${describe(e)} sits outside the ${innerWidth}px viewport`);
 });
 add('Off-viewport actions', offscreen);
 add('Runtime errors', document.getElementById('__s2ui_err')?.textContent ? [document.getElementById('__s2ui_err')!.textContent!] : []);
 return rows;
}
