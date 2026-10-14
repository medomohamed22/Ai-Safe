import assert from 'node:assert/strict';
import { applyElementEdit, describeElement, instrumentPreview, assertLockedElements } from '../src/lib/visualEdit.ts';

const original = `import { useState } from 'react';
export default function App() {
 const [count, setCount] = useState(0);
 const style = { color: 'red', margin: 12 };
 return <main><h1>Hello</h1><button onClick={() => setCount(count + 1)} style={style}>Add</button><output>{count}</output></main>;
}`;
const changed = applyElementEdit(original, 2, { text: 'Save {now} <&>', backgroundColor: '#123456', padding: 16 });
assert.match(changed, /onClick=.*setCount/);
assert.match(changed, /\.\.\.style/);
assert.match(changed, /backgroundColor: "#123456"/);
assert.equal(describeElement(changed, 2).text, 'Save {now} <&>');
assert.match(applyElementEdit(changed, 2, { text: 'Again' }), /Again/);
assert.throws(() => applyElementEdit(original, 3, { text: 'Broken' }), /Dynamic or nested/);
assert.throws(() => applyElementEdit(original, 2, { padding: -1 }), /between/);
assert.throws(() => applyElementEdit(original, 2, { color: 'url(bad)' }), /valid color/);
assert.throws(() => describeElement(original, 99), /no longer/);
assert.equal((instrumentPreview(original).match(/data-s2ui-id=/g) || []).length, 4);
assert.doesNotMatch(changed, /data-s2ui-id/);
assertLockedElements(changed, [describeElement(original, 1).snippet]);
assert.throws(() => assertLockedElements(changed, [describeElement(original, 2).snippet]), /locked element/);
console.log('Visual edit source checks passed (handlers, dynamic styles/text, literal text, repeat edits, validation, instrumentation).');
