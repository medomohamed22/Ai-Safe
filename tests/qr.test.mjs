import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = (code) => build({ stdin: { contents: code, resolveDir: 'src/lib', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false }).then(r => import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')));

const qr = await bundle(`export * from './qr.ts';`);

// Golden matrix for 'HELLO WORLD' (byte mode, ECC M, version 1) produced by the
// vendored qrcode-generator 1.4.4 and verified decodable with OpenCV's
// QRCodeDetector during development.
const GOLDEN = [
  '111111101000101111111',
  '100000101000101000001',
  '101110100000001011101',
  '101110101010101011101',
  '101110100111001011101',
  '100000100011101000001',
  '111111101010101111111',
  '000000001111100000000',
  '101101110101101001011',
  '011000010111111101100',
  '000001111101010100011',
  '101011011001000101010',
  '100010110110110000101',
  '000000001011001100101',
  '111111101011111110000',
  '100000101110010101111',
  '101110100100101001000',
  '101110101110001001110',
  '101110101100100100100',
  '100000100111011110001',
  '111111101101010100000'
];

test('qrMatrix reproduces the verified golden matrix for HELLO WORLD', () => {
  const m = qr.qrMatrix('HELLO WORLD');
  assert.ok(m);
  assert.equal(m.length, 21);
  const rows = m.map(row => row.map(d => (d ? '1' : '0')).join(''));
  assert.deepEqual(rows, GOLDEN);
});

test('qrMatrix returns null for text that fits no QR version', () => {
  assert.equal(qr.qrMatrix('x'.repeat(5000)), null);
});

test('qrSvgPath draws one subpath per dark module inside the quiet zone', () => {
  const path = qr.qrSvgPath([[true, false], [false, true]]);
  assert.equal(path, 'M4 4h1v1h-1zM5 5h1v1h-1z');
});
