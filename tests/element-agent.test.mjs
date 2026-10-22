import assert from 'node:assert/strict';
const { elementContext, parseAgentReply, applyElementReplacement, applyElementInsert, applyAgentEdit, countChangedLines } = await import('../src/lib/elementAgent.ts');
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

// Insert mode (item 33): a new element lands as the container's last child,
// on its own line, with everything else byte-identical.
const withCard = applyElementInsert(code, 0, '<span className="badge">New</span>');
assert.ok(withCard.includes('<p>Footer text</p>\n      <span className="badge">New</span>\n    </div>'));
assert.ok(withCard.startsWith(code.slice(0, code.indexOf('<p>Footer'))));
assert.throws(() => applyElementInsert(code, 0, '<p>a</p><p>b</p>'), /exactly one JSX element/);
assert.throws(() => applyElementInsert(code, 0, '<span onClick={() => setCount(}>x</span>'), /not valid JSX|failed verification/);

// A self-closing element cannot contain children — the error points at the parent instead.
const imgCode = code.replace('<p>Footer text</p>', '<img src="a.png" alt="" />');
assert.throws(() => applyElementInsert(imgCode, 3, '<span>x</span>'), /cannot contain children/);

// Multi-element runs (item 33): the app edits last-element-first so the
// waiting indices stay valid — simulate its exact loop on the evolving
// source and prove both outer elements change while the middle is untouched.
let working = code;
for (const id of [3, 1]) { // descending: p first, then h1
  working = applyElementReplacement(working, id, id === 3 ? '<p className="foot">Footer text</p>' : '<h1 className="big">Counter</h1>');
}
assert.ok(working.includes('<h1 className="big">Counter</h1>'));
assert.ok(working.includes('<p className="foot">Footer text</p>'));
assert.ok(working.includes('<button onClick={() => setCount(count + 1)}>Count: {count}</button>'));
// --- v3: behavior edits -------------------------------------------------
// The reply protocol: JSON with replace + addState for behavior changes.
assert.deepEqual(
  parseAgentReply('{"replace": "<button>Menu</button>", "addState": "const [open, setOpen] = useState(false);"}'),
  { kind: 'edit', jsx: '<button>Menu</button>', addState: 'const [open, setOpen] = useState(false);' },
);

// "Make it open a menu": wrapper + conditional menu + state injected into
// the host component after its existing hook, everything else untouched.
const menuJsx = '<div className="relative"><button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>Count: {count}</button>{menuOpen && (<div className="menu"><a href="#">Profile</a></div>)}</div>';
const withMenu = applyAgentEdit(code, 2, { jsx: menuJsx, addState: 'const [menuOpen, setMenuOpen] = useState(false);' });
assert.ok(withMenu.includes('const [count, setCount] = useState(0);\n  const [menuOpen, setMenuOpen] = useState(false);'), 'state lands after the existing hook');
assert.ok(withMenu.includes('menuOpen && (<div className="menu">'), 'the conditional menu is in place');
assert.ok(withMenu.includes('<h1>Counter</h1>'), 'the rest of the page stayed untouched');
assert.equal((withMenu.match(/import \{ useState \} from 'react'/g) || []).length, 1, 'the existing hook import is not duplicated');

// On a hookless page the system adds the React hook import itself.
const bare = 'export default function App() {\n  return (\n    <button>Open menu</button>\n  );\n}\n';
const bareMenu = applyAgentEdit(bare, 0, { jsx: menuJsx.replace('Count: {count}', 'Open menu').replace('onClick={() => setMenuOpen(!menuOpen)}', 'onClick={() => setMenuOpen(!menuOpen)}'), addState: 'const [menuOpen, setMenuOpen] = useState(false);' });
assert.ok(bareMenu.startsWith("import { useState } from 'react';"), 'hook import added at the top');
assert.ok(bareMenu.includes('const [menuOpen, setMenuOpen] = useState(false);\n  return ('), 'state lands inside the component before the return');

// The old silent breakage is now refused: names that do not exist here.
assert.throws(() => applyElementReplacement(code, 2, '<button onClick={() => setOpen(!open)}>Count: {count}</button>'), /names that do not exist here: open, setOpen/);
assert.throws(() => applyElementReplacement(code, 2, '<button><ChevronDown size={16} /></button>'), /names that do not exist here: ChevronDown/);

// Names the replacement declares itself (event params) are fine.
assert.ok(applyElementReplacement(code, 2, '<button onClick={(e) => { e.preventDefault(); setCount(count + 1); }}>Count: {count}</button>').includes('e.preventDefault()'));

// addState discipline: fresh names only, exactly one hook declaration.
assert.throws(() => applyAgentEdit(code, 2, { jsx: '<button>x</button>', addState: 'const [count, setCount] = useState(0);' }), /already exists/);
assert.throws(() => applyAgentEdit(code, 2, { jsx: '<button>x</button>', addState: 'let open = false;' }), /exactly one const declaration/);
assert.throws(() => applyAgentEdit(code, 2, { jsx: '<button>x</button>', addState: 'const [a, setA] = useState(false); const [b, setB] = useState(false);' }), /not valid code|exactly one const/);

// A fragment root is a valid single root (element + its own sibling).
assert.ok(applyElementReplacement(code, 2, '<><button>Menu</button><div>Panel</div></>').includes('<div>Panel</div>'));
console.log('PASS element-agent: exact-range read with context, byte-identical splice outside the element, verification refuses garbage/multi-element/locked edits, reply parsing handles fences, raw JSX and escalations, insert mode lands a verified last child and refuses childless containers, descending-order multi-edits keep indices valid, v3 behavior edits inject verified state (+hook import) and refuse undefined names, name collisions and malformed state.');
