import assert from 'node:assert/strict';
import { parseScenarios, selectorProblem } from '../src/lib/interactionTests.ts';

// P1-02: one selector contract for generation, validation and the runner.
assert.equal(selectorProblem('button.primary'), null);
assert.equal(selectorProblem("button:has-text('إضافة مهمة')"), null, 'the reported Arabic has-text form is supported');
assert.equal(selectorProblem('button:has-text("Add task")'), null);
assert.match(selectorProblem('button:has-text(إضافة مهمة)'), /has-text/, 'unquoted has-text is a setup problem');
assert.match(selectorProblem('div >> span'), /Playwright-only/);
assert.match(selectorProblem('xpath=//button'), /Playwright-only/);

const ok = parseScenarios(JSON.stringify([{ name: 'Add task', steps: [
  { action: 'fill', selector: 'input[name=title]', value: 'Task one' },
  { action: 'click', selector: "button:has-text('إضافة مهمة')" },
  { action: 'expectText', selector: '#list', value: 'Task one' },
] }]));
assert.equal(ok.length, 1, 'a contract-valid scenario parses');

assert.throws(() => parseScenarios(JSON.stringify([{ name: 'Bad selector', steps: [
  { action: 'click', selector: 'div >> span' },
  { action: 'exists', selector: '#list' },
] }])), /Playwright-only/, 'an unsupported selector is rejected at parse time with the reason');

assert.throws(() => parseScenarios(JSON.stringify([{ name: 'No assertion', steps: [
  { action: 'click', selector: '#add' },
] }])), /assertion/, 'a scenario without an assertion is rejected (P1-03)');
console.log('scenario-contract tests passed.');
