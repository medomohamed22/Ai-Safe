import assert from 'node:assert/strict';
const { dominantColors, luminance } = await import('../src/lib/palette.ts');

// 80% near-red, 20% deep blue samples.
const samples = [];
for (let i = 0; i < 80; i++) samples.push(204, 32, 24);
for (let i = 0; i < 20; i++) samples.push(24, 48, 160);
const colors = dominantColors(samples, 5);
assert.equal(colors[0], '#cc2018', 'the dominant cluster wins and averages exactly');
assert.ok(colors.includes('#1830a0'), 'the minority cluster is still reported');
assert.equal(dominantColors([], 5).length, 0, 'no samples, no colors');
// Near-identical shades collapse into one pick instead of filling the list.
const shades = [];
for (let i = 0; i < 50; i++) shades.push(200 + (i % 8), 30, 30);
for (let i = 0; i < 50; i++) shades.push(30, 30, 200 + (i % 8));
assert.equal(dominantColors(shades, 5).length, 2, 'shade jitter merges');
assert.ok(Math.abs(luminance('#ffffff') - 1) < 0.001 && luminance('#000000') === 0, 'luminance endpoints');
console.log('PASS palette: dominant buckets win in weight order, minority clusters survive, shade jitter merges, luminance endpoints exact.');
