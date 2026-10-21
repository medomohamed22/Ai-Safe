import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = (entry, code) => build({ stdin: { contents: code, resolveDir: 'src/lib', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false }).then(r => import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')));

const { PRESETS } = await bundle('presets', `export * from './presets.ts';`);

const ARABIC = /[\u0600-\u06FF]/;
const textsOf = (preset) => preset.elements.filter((e) => e.type === 'text').map((e) => e.text || '').concat(preset.elements.map((e) => e.label?.text || ''));
const hasRedAnnotation = (preset) => preset.elements.some((e) => e.strokeColor === '#e03131');

test('gallery presets: 3 English + landing + 3 Arabic sketches exist', () => {
  for (const key of ['dashboard', 'landing', 'mobile', 'store', 'dashboardAr', 'storeAr', 'mobileAr']) {
    assert.ok(PRESETS[key], `missing preset ${key}`);
    assert.ok(PRESETS[key].elements.length >= 15, `${key} has too few elements`);
    assert.ok(hasRedAnnotation(PRESETS[key]), `${key} has no red annotation`);
  }
});

test('Arabic presets carry Arabic labels and Arabic annotations', () => {
  for (const key of ['dashboardAr', 'storeAr', 'mobileAr']) {
    const texts = textsOf(PRESETS[key]);
    assert.ok(texts.some((t) => ARABIC.test(t)), `${key} has no Arabic text`);
    const redTexts = PRESETS[key].elements.filter((e) => e.strokeColor === '#e03131' && e.type === 'text').map((e) => e.text || '');
    assert.ok(redTexts.some((t) => ARABIC.test(t)), `${key} has no Arabic red annotation`);
  }
});

test('English presets contain no Arabic text', () => {
  for (const key of ['dashboard', 'landing', 'mobile', 'store']) {
    assert.ok(!textsOf(PRESETS[key]).some((t) => ARABIC.test(t)), `${key} unexpectedly contains Arabic`);
  }
});
