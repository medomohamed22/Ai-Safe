import assert from 'node:assert/strict';
const { elementContext, parseAgentReply, applyElementReplacement, countChangedLines } = await import('../src/lib/elementAgent.ts');
const { describeElement } = await import('../src/lib/visualEdit.ts');

const code = `import { useState } from 'react';
export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="page">
      <h1>Counter</h1>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <p>Footer text</p>
    </div>
  );
}
`;
// Element ids follow the visual editor's traversal: div=0, h1=1, button=2, p=3.

// Read: the agent gets the exact source slice, its parent, and the head.
const ctx = elementContext(code, 2);
assert.equal(ctx.tag, 'button');
assert.equal(ctx.snippet, '<button onClick={() => setCount(count + 1)}>Count: {count}</button>');
assert.ok(ctx.parentSnippet.startsWith('<div className="page">'));
assert.match(ctx.head, /useState/);
assert.match(ctx.head, /const \[count, setCount\]/);
assert.equal(code.slice(ctx.start, ctx.end), ctx.snippet);

// Edit: only the element's range changes — everything else is byte-identical.
const next = applyElementReplacement(code, 2, '<button className="green" onClick={() => setCount(count + 1)}>Count: {count}</button>');
assert.ok(next.startsWith(code.slice(0, ctx.start)));
assert.ok(next.endsWith(code.slice(ctx.end)));
assert.match(next, /className="green"/);
assert.equal(countChangedLines(code, next), 2);

// A no-op replacement returns the source unchanged.
assert.equal(applyElementReplacement(code, 2, ctx.snippet), code);
assert.equal(countChangedLines(code, code), 0);

// Verify: garbage, multi-element replacements, and broken splices are refused.
assert.throws(() => applyElementReplacement(code, 2, 'not jsx at all'), /not valid JSX|exactly one/);
assert.throws(() => applyElementReplacement(code, 2, '<p>a</p><p>b</p>'), /exactly one JSX element/);
assert.throws(() => applyElementReplacement(code, 2, '<button onClick={() => setCount(}>x</button>'), /not valid JSX|failed verification/);

// Verify: a locked element elsewhere survives; editing the locked one is refused.
const lock = describeElement(code, 1).snippet;
assert.ok(applyElementReplacement(code, 2, '<button className="x">Count: {count}</button>', [lock]).includes('<h1>Counter</h1>'));
assert.throws(() => applyElementReplacement(code, 1, '<h1>Changed</h1>', [lock]), /locked element was changed/);

// Reply parsing: fenced JSX, raw JSX, escalation JSON, and plain refusals.
assert.deepEqual(parseAgentReply('```jsx\n<button>Hi</button>\n```'), { kind: 'edit', jsx: '<button>Hi</button>' });
assert.deepEqual(parseAgentReply('<button>Hi</button>'), { kind: 'edit', jsx: '<button>Hi</button>' });
assert.deepEqual(parseAgentReply('{"escalate": "needs page-level state"}'), { kind: 'escalate', reason: 'needs page-level state' });
assert.throws(() => parseAgentReply('I cannot do that.'), /not return a usable edit/);
assert.throws(() => elementContext(code, 99), /no longer available/);
console.log('PASS element-agent: exact-range read with context, byte-identical splice outside the element, verification refuses garbage/multi-element/locked edits, reply parsing handles fences, raw JSX and escalations.');
