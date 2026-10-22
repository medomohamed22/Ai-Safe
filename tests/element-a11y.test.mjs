import assert from 'node:assert/strict';
const { elementA11yChecks, contrastRatio } = await import('../src/lib/elementA11y.ts');

assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.1);
assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
assert.equal(contrastRatio('red', '#ffffff'), null);

// Low-contrast text warns and offers the passing fix color.
const low = elementA11yChecks('<button style={{ color: "#777777", backgroundColor: "#ffffff" }}>Save</button>', 'button');
const contrast = low.find(c => c.id === 'contrast');
assert.equal(contrast.status, 'warn');
assert.deepEqual(contrast.fix, { color: '#000000' });
assert.equal(low.find(c => c.id === 'name').status, 'pass'); // visible text names it

// An icon-only button cannot be named by a screen reader — warn with an agent hint, no fake fix.
const icon = elementA11yChecks('<button onClick={() => go()}><svg viewBox="0 0 24 24" /></button>', 'button');
const name = icon.find(c => c.id === 'name');
assert.equal(name.status, 'warn');
assert.ok(name.agentHint && !name.fix);

// Explicit small size warns with a 40px fix; no explicit size stays honestly unknown.
const small = elementA11yChecks('<button style={{ width: 24, height: 24 }}>Go</button>', 'button');
assert.equal(small.find(c => c.id === 'target').status, 'warn');
assert.deepEqual(small.find(c => c.id === 'target').fix, { width: 40, height: 40 });
const unsized = elementA11yChecks('<button className="px-4 py-2">Go</button>', 'button');
assert.equal(unsized.find(c => c.id === 'target').status, 'unknown');

// Tailwind hex classes are measured too; a non-interactive element gets no name/target rows.
const tw = elementA11yChecks('<p className="text-[#111111] bg-[#ffffff]">Hello</p>', 'p');
assert.equal(tw.find(c => c.id === 'contrast').status, 'pass');
assert.equal(tw.length, 1);
console.log('PASS element-a11y: WCAG contrast math, honest unknown states, direct fixes for contrast and tap size, agent hint for missing names.');
