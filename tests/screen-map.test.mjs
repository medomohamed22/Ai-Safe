import assert from 'node:assert/strict';
import { layoutScreens, resolvePositions, mapBounds, flowOrder, MAP_CARD_W } from '../src/lib/screenMap.ts';

const s = (id) => ({ id, name: id, versions: [], vIndex: -1, scene: null });

// A link chain becomes left-to-right columns on one row.
const chain = { activeId: 'a', screens: [s('a'), s('b'), s('c')], links: [{ from: 'a', to: 'b', label: 'B' }, { from: 'b', to: 'c', label: 'C' }] };
const pos = layoutScreens(chain);
assert.ok(pos.a.x < pos.b.x && pos.b.x < pos.c.x);
assert.equal(pos.a.y, pos.b.y);
assert.equal(pos.b.y, pos.c.y);

// Branches share a column and stack vertically.
const branch = { activeId: 'a', screens: [s('a'), s('b'), s('c')], links: [{ from: 'a', to: 'b', label: '' }, { from: 'a', to: 'c', label: '' }] };
const bp = layoutScreens(branch);
assert.equal(bp.b.x, bp.c.x);
assert.ok(bp.b.y < bp.c.y);

// Unlinked screens land in a trailing column, after the flow.
const withOrphan = { activeId: 'a', screens: [s('a'), s('b'), s('z')], links: [{ from: 'a', to: 'b', label: '' }] };
const op = layoutScreens(withOrphan);
assert.ok(op.z.x > op.b.x);

// Saved positions override the layout; missing ones fall back to it.
const saved = resolvePositions({ ...chain, mapPositions: { b: { x: 999, y: 888 } } });
assert.deepEqual(saved.b, { x: 999, y: 888 });
assert.equal(saved.a.x, pos.a.x);

// Bounds cover every card.
const b = mapBounds(pos);
assert.ok(b.maxX - b.minX >= MAP_CARD_W * 3);
assert.equal(b.minX, pos.a.x);

// Flow order follows the link chain, then unlinked screens in list order.
const fo = flowOrder(chain);
assert.equal(fo.a, 0); assert.equal(fo.b, 1); assert.equal(fo.c, 2);
const foOrphan = flowOrder(withOrphan);
assert.equal(foOrphan.a, 0); assert.equal(foOrphan.b, 1); assert.equal(foOrphan.z, 2);
const foBranch = flowOrder(branch);
assert.equal(foBranch.a, 0); assert.equal(foBranch.b, 1); assert.equal(foBranch.c, 2);
assert.deepEqual(flowOrder({ activeId: '', screens: [], links: [] }), {});

console.log('screen-map tests passed.');
