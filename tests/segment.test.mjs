import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = (entry, code) => build({ stdin: { contents: code, resolveDir: 'src/lib', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false }).then(r => import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')));

const seg = await bundle('segment', `export * from './segment.ts';`);

const SAM_SAMPLE = '<0>1<|box;x1=100;y1=50;x2=300;y2=150;w=1000;h=800|><|mask;x=0;y=0;data=800,1000,~abcXYZ|>,2<|box;x1=400;y1=200;x2=500;y2=260;w=1000;h=800|><|mask;x=0;y=0;data=800,1000,!zz|>';

test('parseSamTokens reads SAM 3 protocol box records in source pixels', () => {
  const parsed = seg.parseSamTokens(SAM_SAMPLE);
  assert.ok(parsed);
  assert.equal(parsed.width, 1000);
  assert.equal(parsed.height, 800);
  assert.equal(parsed.boxes.length, 2);
  assert.deepEqual(parsed.boxes[0], { id: '1', x: 100, y: 50, w: 200, h: 100 });
  assert.deepEqual(parsed.boxes[1], { id: '2', x: 400, y: 200, w: 100, h: 60 });
});

test('parseSamTokens returns null when no boxes are present', () => {
  assert.equal(seg.parseSamTokens('no segmentation here'), null);
  assert.equal(seg.parseSamTokens(''), null);
});

test('parseVisionElements parses fenced JSON and clamps coordinates', () => {
  const text = 'Here you go:\n```json\n{"elements":[{"label":"header","x":120,"y":60,"w":1500,"h":120},{"label":"bad","x":0,"y":0,"w":0,"h":10}]}\n```';
  const els = seg.parseVisionElements(text);
  assert.equal(els.length, 1);
  assert.equal(els[0].label, 'header');
  assert.equal(els[0].w, 1000);
});

test('parseVisionElements returns null on garbage', () => {
  assert.equal(seg.parseVisionElements('nothing to see'), null);
  assert.equal(seg.parseVisionElements('{"elements":"nope"}'), null);
});

test('formatElementMap lists elements in 0-1000 space and names the engine honestly', () => {
  const map = seg.formatElementMap([{ label: 'header', x: 0.1, y: 0.05, w: 0.8, h: 0.15 }], 'vision');
  assert.match(map, /vision segmentation/);
  assert.match(map, /1\. header - x=100, y=50, w=800, h=150/);
  const samMap = seg.formatElementMap([{ label: 'element 1', x: 0, y: 0, w: 0.5, h: 0.5 }], 'sam-3.1');
  assert.match(samMap, /SAM 3\.1 segmentation/);
});
