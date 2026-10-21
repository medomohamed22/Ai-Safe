import assert from 'node:assert/strict';
import { buildPreviewHtml, isArabicCode } from '../src/lib/preview.ts';

// Item 15: an Arabic design must produce a right-to-left document with an
// Arabic font wherever the preview document is built (studio, map, publish).
const arabic = buildPreviewHtml('export default function App(){return <h1>لوحة التحكم</h1>}');
assert.ok(arabic.includes('<html lang="ar" dir="rtl">'), 'arabic code -> rtl document');
assert.ok(arabic.includes('family=Cairo'), 'arabic code -> Cairo font loaded');
assert.ok(arabic.includes("font-family: 'Cairo', Inter"), 'Cairo leads the body font stack');

const english = buildPreviewHtml('export default function App(){return <h1>Dashboard</h1>}');
assert.ok(english.includes('<html>'), 'english code -> plain document');
assert.ok(!english.includes('dir="rtl"'), 'english code -> no rtl');
assert.ok(!english.includes('Cairo'), 'english code -> no Cairo download');

assert.equal(isArabicCode('const label = "المهام";'), true);
assert.equal(isArabicCode('const label = "Tasks";'), false);
console.log('preview-rtl tests passed.');
