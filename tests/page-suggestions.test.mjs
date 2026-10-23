import assert from 'node:assert/strict';
const { PAGE_SUGGESTIONS, pageBrief, resolveContentLanguage } = await import('../src/lib/pageSuggestions.ts');
const { pageGroupHtml, pageGroupScreens } = await import('../src/lib/pageGroup.ts');
const { normalizeBrand } = await import('../src/lib/brand.ts');

assert.equal(PAGE_SUGGESTIONS.length, 6, 'six page types');
const ids = new Set();
for (const s of PAGE_SUGGESTIONS) {
  assert.ok(s.titleEn && s.titleAr && s.cases.length >= 2, `${s.id} is fully defined`);
  assert.ok(!ids.has(s.id)); ids.add(s.id);
  for (const c of s.cases) assert.ok(c.titleEn && c.titleAr && c.briefEn && c.briefAr, `${s.id}/${c.id} has both briefs`);
}
const login = PAGE_SUGGESTIONS[0];
assert.ok(pageBrief(login, null, 'en', 'Noor').includes('for "Noor"'), 'the main brief names the brand');
assert.ok(pageBrief(login, login.cases[0], 'en', '').includes('Error state'), 'a case brief names its state');
assert.ok(pageBrief(login, null, 'ar', '').includes('صفحة تسجيل الدخول'), 'Arabic briefs use the Arabic titles');

const brand = normalizeBrand({});
assert.equal(resolveContentLanguage(normalizeBrand({ language: 'ar' }), [], 'en'), 'ar', 'an explicit system language wins');
assert.equal(resolveContentLanguage(brand, [{ id: '1', kind: 'doc', name: 'd.md', mime: '', size: 1, addedAt: 1, text: 'دليل', lang: 'ar' }], 'en'), 'ar', 'documents decide when the system is on auto');
assert.equal(resolveContentLanguage(brand, [], 'ar'), 'ar', 'otherwise the UI language decides');
assert.equal(resolveContentLanguage(brand, [], 'en'), 'en');

const code = (t) => `export default function App(){return <h1>${t}</h1>}`;
const project = {
  activeId: 'root',
  screens: [
    { id: 'root', name: 'Log in page', versions: [code('Login')], vIndex: 0, scene: null },
    { id: 'err', name: 'Log in page — Error state', versions: [code('Error')], vIndex: 0, scene: null },
    { id: 'other', name: 'Unrelated', versions: [code('Other')], vIndex: 0, scene: null },
  ],
  links: [{ from: 'root', to: 'err', label: 'Error state' }, { from: 'err', to: 'root', label: 'Log in page' }],
};
assert.equal(pageGroupScreens(project, 'root').length, 2, 'the group is the root plus its link neighbors');
const out = pageGroupHtml(project, 'root');
assert.ok(out && out.html.includes('Log in page — Error state') && (out.html.match(/<iframe/g) || []).length === 2, 'one file, one iframe per state, switcher included');
assert.ok(!out.html.includes('Unrelated'), 'unlinked screens stay out');
assert.equal(pageGroupHtml({ activeId: 'x', screens: [{ id: 'x', name: 'Empty', versions: [], vIndex: -1, scene: null }], links: [] }, 'x'), null, 'nothing generated yet, nothing to export');
console.log('PASS page-suggestions: six bilingual page types with state briefs, language resolution (system > documents > UI), and a one-file page-group export scoped to linked screens.');
