import assert from 'node:assert/strict';
import { projectFiles, backendHandoff } from '../src/lib/projectExport.ts';
import { DEFAULT_BACKEND } from '../src/lib/backend.ts';

const code = 'export default function App(){return <h1>Shop</h1>}';
const backend = { mode: 'demo', baseUrl: 'https://api.example.test', endpoints: [
  { id: 'listProducts', method: 'GET', path: '/products', dataPath: 'data.items', fields: { title: 'name', price: 'price' } },
  { id: 'createOrder', method: 'POST', path: '/orders', dataPath: '', fields: {} },
] };
const project = { activeId: 'a', screens: [
  { id: 'a', name: 'Catalog', versions: [code], vIndex: 0, scene: null },
  { id: 'b', name: 'Checkout', versions: [code], vIndex: 0, scene: null },
], links: [{ from: 'a', to: 'b', label: 'Buy' }] };

// With configured endpoints, the handoff lists them as an implementable table.
const files = projectFiles(code, backend, project);
assert.ok(files['BACKEND.md'], 'the export includes BACKEND.md');
assert.match(files['BACKEND.md'], /listProducts \| GET \| \/products \| data\.items \| title → name, price → price/);
assert.match(files['BACKEND.md'], /createOrder \| POST \| \/orders/);
assert.match(files['BACKEND.md'], /Catalog \(`a`\)/);
assert.match(files['BACKEND.md'], /Checkout \(`b`\)/);
assert.match(files['BACKEND.md'], /Connecting a real backend — checklist/);
assert.match(files['README.md'], /BACKEND\.md/, 'the README points at the handoff document');
assert.ok(files['API_CONTRACT.json'], 'the machine-readable contract is still exported');

// Without a configured API, the handoff honestly explains the proposed
// per-screen contracts instead of inventing an endpoint table.
const plain = backendHandoff(DEFAULT_BACKEND);
assert.match(plain, /No API was configured/);
assert.match(plain, /proposed contract/);
assert.ok(!plain.includes('| GET |'), 'no fabricated endpoint rows');
console.log('backend-handoff tests passed.');
