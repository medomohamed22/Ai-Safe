import assert from 'node:assert/strict';
const { buildPreviewHtml } = await import('../src/lib/preview.ts');

// The in-preview editing bridge contract (after the drag rework): selecting
// an element must never move or resize it. Resize lives on the visible
// handles only, a move is armed only for an element that was already
// selected, both gestures wait out a movement threshold (larger for touch),
// and Escape cancels a drag in progress.
const html = buildPreviewHtml('export default function App(){return <button>Hi</button>}', { token: 'test-token' });
assert.ok(!html.includes('bandX') && !html.includes('nearR') && !html.includes('nearB'), 'no invisible resize bands on the element body');
assert.ok(html.includes('wasSelected'), 'move is armed only for the already-selected element');
assert.ok(html.includes("e.pointerType === 'touch' ? 12 : 8"), 'drag thresholds: 8px mouse, 12px touch');
assert.ok(html.includes("e.key === 'Escape'") && html.includes('endDrag(false)'), 'Escape cancels a drag in progress');
assert.ok(html.includes('data-s2ui-handle'), 'the visible resize handles remain the resize entry point');
console.log('PASS preview-editing: the bridge selects without dragging — handles-only resize, pre-selected move arming, touch-aware thresholds, Escape cancel.');
