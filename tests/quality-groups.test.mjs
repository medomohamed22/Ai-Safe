import assert from 'node:assert/strict';
import { qualityGroupOf, QUALITY_GROUPS } from '../src/lib/quality.ts';

// P3-04: every known check lands in its action group; width prefixes are
// stripped before classifying; free-text scenario names fall to Acceptance.
assert.deepEqual([...QUALITY_GROUPS], ['Build', 'Runtime', 'Responsive', 'Accessibility', 'Acceptance scenarios']);
for (const n of ['JSX syntax', 'React entry point', 'Production JavaScript bundle']) assert.equal(qualityGroupOf(n), 'Build', n);
for (const n of ['Rendered content', 'Runtime errors', '390px · Runtime', 'Cancelled']) assert.equal(qualityGroupOf(n), 'Runtime', n);
for (const n of ['Horizontal overflow', 'Content clipping', 'Fixed overlay coverage', 'Off-viewport actions', '820px · Content clipping', '1440px · Horizontal overflow']) assert.equal(qualityGroupOf(n), 'Responsive', n);
for (const n of ['Button names', 'Form labels', 'Image alternatives', '390px · Button names']) assert.equal(qualityGroupOf(n), 'Accessibility', n);
for (const n of ['Acceptance scenarios', 'Adding a task shows it in the list', '390px · Checkout completes']) assert.equal(qualityGroupOf(n), 'Acceptance scenarios', n);
console.log('quality-groups tests passed.');
