import assert from 'node:assert/strict';
import { buildPreviewHtml } from '../src/lib/preview.ts';

// P1-01: every preview document carries the storage guard; the bridge and
// the seed are embedded only when the editor asks for them.
const plain = buildPreviewHtml('export default function App(){return <h1>x</h1>}');
assert.ok(plain.includes("install('localStorage'"), 'shim installs a localStorage fallback');
assert.ok(plain.includes("install('sessionStorage'"), 'shim installs a sessionStorage fallback');
assert.ok(plain.includes('var bridgeToken = null;'), 'no bridge without the editor flag');
assert.ok(plain.includes('SecurityError'), 'the guard documents the sandbox failure it fixes');

const bridged = buildPreviewHtml('export default function App(){return <h1>x</h1>}', { token: 'tok-123', storageBridge: true, storageSeed: { task: 'seeded value' } });
assert.ok(bridged.includes('var bridgeToken = "tok-123";'), 'bridge token embedded for the editor preview');
assert.ok(bridged.includes('"task":"seeded value"'), 'the per-screen seed is embedded');
assert.ok(bridged.includes("type: 'storage'"), 'the shim posts storage snapshots to the parent');

const testsDoc = buildPreviewHtml('export default function App(){return <h1>x</h1>}', { token: 'tok-9', tests: true });
assert.ok(testsDoc.includes('var bridgeToken = null;'), 'test-runner documents never bridge storage back');
console.log('preview-storage tests passed.');
