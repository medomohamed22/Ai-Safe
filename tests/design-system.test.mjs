import assert from 'node:assert/strict';
import { designSystemMarkdown, parseDesignSystem } from '../src/lib/designSystem.ts';
import { projectFiles, handoffDocument } from '../src/lib/projectExport.ts';
import { DEFAULT_BACKEND } from '../src/lib/backend.ts';

const brand = { enabled: true, name: 'Acme', primary: '#112233', secondary: '#445566', background: '#ffffff', text: '#111111', font: 'Georgia', radius: 18, direction: 'rtl', logo: '' };
const md = designSystemMarkdown(brand);
assert.match(md, /# DESIGN\.md — Acme/);
assert.match(md, /- Primary: #112233/);
assert.match(md, /- Radius: 18px/);
const back = parseDesignSystem(md);
assert.equal(back.name, 'Acme');
assert.equal(back.primary, '#112233');
assert.equal(back.secondary, '#445566');
assert.equal(back.background, '#ffffff');
assert.equal(back.text, '#111111');
assert.equal(back.font, 'Georgia');
assert.equal(back.radius, 18);
assert.equal(back.direction, 'rtl');
assert.deepEqual(parseDesignSystem('# Meeting notes\nNo tokens here.'), {}, 'a foreign file without labels parses to nothing');

const code = 'export default function App(){return <h1>Shop</h1>}';
const project = { activeId: 'a', screens: [
  { id: 'a', name: 'Home', versions: [code], vIndex: 0, scene: null, chat: [
    { id: '1', role: 'user', text: 'make it blue' },
    { id: '2', role: 'ai', kind: 'built' },
  ] },
  { id: 'b', name: 'Checkout', versions: [], vIndex: -1, scene: null },
], links: [{ from: 'a', to: 'b', label: 'Buy' }] };
const files = projectFiles(code, DEFAULT_BACKEND, project);
assert.ok(files['HANDOFF.md'], 'every export carries HANDOFF.md');
assert.match(files['HANDOFF.md'], /make it blue/, 'the handoff records the build conversation');
assert.match(files['HANDOFF.md'], /1 version built from these requests/);
assert.match(files['HANDOFF.md'], /Home → Checkout \("Buy"\)/);
assert.match(files['README.md'], /HANDOFF\.md/);
assert.equal(files['DESIGN.md'], undefined, 'DESIGN.md is exported only when a brand identity is saved and enabled');
assert.match(handoffDocument(project), /## Screens/);
console.log('PASS: design system markdown + handoff document');
