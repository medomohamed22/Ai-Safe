import assert from 'node:assert/strict';
import { buildPreviewHtml } from '../src/lib/preview.ts';
import { pageGroupHtml } from '../src/lib/pageGroup.ts';

const CODE = 'export default function App(){return <main><h1>Sign in</h1><a href="#">Forgot password?</a></main>}';
const targets = [{ id: 's2', name: 'Log in page — Forgot password', label: 'Forgot password' }];

const withNav = buildPreviewHtml(CODE, { token: 't1', navTargets: targets });
assert.ok(withNav.includes('window.s2uiNavigate'), 'the preview provides s2uiNavigate for generated code');
assert.ok(withNav.includes('Log in page — Forgot password'), 'nav targets are embedded for the click fallback');
assert.ok(withNav.includes("type: 'navigate'"), 'navigation posts the navigate message');

const plain = buildPreviewHtml(CODE, { token: 't1' });
assert.ok(!plain.includes('s2uiNavigate'), 'no nav script without targets');
const standalone = buildPreviewHtml(CODE, undefined);
assert.ok(!standalone.includes('s2uiNavigate'), 'standalone exports stay clean without targets');

const project = {
  activeId: 's1',
  links: [{ from: 's1', to: 's2', label: 'Forgot password' }, { from: 's2', to: 's1', label: 'Log in page' }],
  screens: [
    { id: 's1', name: 'Log in page', versions: [CODE], vIndex: 0, scene: null, chat: [] },
    { id: 's2', name: 'Log in page — Forgot password', versions: ['export default function App(){return <main><h1>Reset</h1></main>}'], vIndex: 0, scene: null, chat: [] },
  ],
};
const group = pageGroupHtml(project, 's1');
assert.ok(group, 'the group export builds');
assert.ok(group.html.includes("d.type !== 'navigate'"), 'the group page relays navigate messages between frames');
assert.ok(group.html.includes('s2uiNavigate'), 'group frames carry the navigation helper');
console.log('PASS: preview navigation — s2uiNavigate bridge, click fallback targets, group relay.');
