// Smart "next step" suggestions for the composer, derived from the current
// generated code. Rules are ordered by likely value; static fallbacks fill
// any remaining slots so the row always offers a full set of next steps.
const FALLBACKS = ['Improve spacing', 'Make it responsive', 'Add a footer', 'Simplify the layout', 'Add a settings modal'];

export function suggestNextSteps(code: string, screenCount = 1, max = 5): string[] {
  const picks: string[] = [];
  const add = (s: string) => { if (!picks.includes(s)) picks.push(s); };
  if (code) {
    if (!/dark:/.test(code)) add('Add a dark mode toggle');
    if (/(<table|\$|%|stat|metric)/i.test(code) && !/(chart|polyline|<svg)/i.test(code)) add('Add a data chart');
    if (/<table/i.test(code) && !/search/i.test(code)) add('Add search and filters');
    if (!/<form/i.test(code)) add('Add a form with validation');
    if (screenCount <= 1) add('Add a second screen');
    if (!/(loading|skeleton|empty)/i.test(code)) add('Add loading and empty states');
    if (!/\b(sm|md|lg|xl):/.test(code)) add('Make it responsive');
  }
  for (const f of FALLBACKS) { if (picks.length >= max) break; add(f); }
  return picks.slice(0, max);
}
