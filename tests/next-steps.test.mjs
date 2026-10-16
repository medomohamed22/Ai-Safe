import assert from 'node:assert/strict';
import { suggestNextSteps } from '../src/lib/next-steps.ts';

// Empty code -> pure fallbacks, capped at 5.
assert.deepEqual(suggestNextSteps('', 1), ['Improve spacing', 'Make it responsive', 'Add a footer', 'Simplify the layout', 'Add a settings modal']);

// Bare stats dashboard: no dark mode, no chart, no form, single screen.
const dash = 'export default function App(){return <div className="grid"><div>Total Revenue $48,290</div><div>3.2%</div></div>}';
const s = suggestNextSteps(dash, 1);
assert.equal(s[0], 'Add a dark mode toggle');
assert.ok(s.includes('Add a data chart'));
assert.ok(s.includes('Add a form with validation'));
assert.ok(s.includes('Add a second screen'));
assert.equal(s.length, 5);

// Complete code: dark mode, chart, form, search over a table, several screens.
const full = 'export default function App(){return <div className="dark:bg-black md:grid"><svg><polyline/></svg><form><input placeholder="Search orders"/></form><table></table></div>}';
const f = suggestNextSteps(full, 3);
assert.ok(!f.includes('Add a dark mode toggle'));
assert.ok(!f.includes('Add a data chart'));
assert.ok(!f.includes('Add a second screen'));
assert.ok(f.includes('Add loading and empty states'));

// The responsive rule and the responsive fallback never duplicate.
const plain = 'export default function App(){return <p>Hello</p>}';
const p = suggestNextSteps(plain, 2);
assert.equal(p.filter(x => x === 'Make it responsive').length, 1);
assert.equal(p.length, 5);

console.log('next-steps tests passed.');
