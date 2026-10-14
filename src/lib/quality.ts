import { parse } from '@babel/parser';
import type { ScenarioResult } from './interactionTests';
export function sourceChecks(code: string): ScenarioResult[] {
 try {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const hasDefault = ast.program.body.some(n => n.type === 'ExportDefaultDeclaration');
  return [{ name: 'JSX syntax', passed: true, detail: 'Parsed successfully; this is not a production bundle check.' }, { name: 'React entry point', passed: hasDefault, detail: hasDefault ? 'Default export found' : 'Missing default component export' }];
 } catch (e) { return [{ name: 'JSX syntax', passed: false, detail: (e as Error).message }]; }
}
export function auditDocument(): ScenarioResult[] {
 const root = document.querySelector('#root');
 const rows: ScenarioResult[] = [];
 const add = (name: string, bad: string[]) => rows.push({ name, passed: !bad.length, detail: bad.length ? bad.slice(0, 6).join('; ') : 'Passed this check' });
 add('Rendered content', root?.children.length ? [] : ['No rendered app']);
 add('Horizontal overflow', document.documentElement.scrollWidth > innerWidth + 2 ? [`Content ${document.documentElement.scrollWidth}px exceeds ${innerWidth}px`] : []);
 const name = (e: Element) => e.getAttribute('aria-label')?.trim() || (e.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join('').trim() || e.getAttribute('title') || e.textContent?.trim();
 add('Button names', Array.from(root?.querySelectorAll('button') || []).filter(e => !name(e)).map(() => 'Button has no accessible name'));
 add('Form labels', Array.from(root?.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),textarea,select') || []).filter(e => !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !(e as HTMLInputElement).labels?.length).map(e => `Unlabelled ${e.tagName.toLowerCase()}`));
 add('Image alternatives', Array.from(root?.querySelectorAll('img') || []).filter(e => !e.hasAttribute('alt') && e.getAttribute('role') !== 'presentation').map(() => 'Image missing alt'));
 add('Runtime errors', document.getElementById('__s2ui_err')?.textContent ? [document.getElementById('__s2ui_err')!.textContent!] : []);
 return rows;
}
