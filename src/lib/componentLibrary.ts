import { parse } from '@babel/parser';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { load, save } from './storage';
export interface LibraryComponent { name: string; code: string; description: string }
export const LIBRARY_KEY = 's2ui.components.v1';
export const components = () => load<LibraryComponent[]>(LIBRARY_KEY, []);
export function validateComponent(component: LibraryComponent) {
 if (!/^[A-Z][A-Za-z0-9]{0,50}$/.test(component.name)) throw new Error('Use a PascalCase component name.');
 const ast = parse(component.code, { sourceType: 'module', plugins: ['jsx'] });
 if (!ast.program.body.some(n => t.isExportDefaultDeclaration(n) && (t.isFunctionDeclaration(n.declaration) || t.isArrowFunctionExpression(n.declaration) || t.isFunctionExpression(n.declaration) || t.isIdentifier(n.declaration)))) throw new Error('Component needs a default function export.');
 for (const n of ast.program.body) if (t.isImportDeclaration(n) && !['react', 'lucide-react'].includes(n.source.value)) throw new Error('Reusable components currently support React and lucide-react imports only.');
 if (ast.program.body.some(n => t.isExportNamedDeclaration(n) || t.isExportAllDeclaration(n))) throw new Error('Use one default component export.');
}
export function saveComponents(value: LibraryComponent[]) {
 if (value.length > 30 || new Set(value.map(c => c.name)).size !== value.length) throw new Error('Use up to 30 uniquely named components.');
 value.forEach(validateComponent); save(LIBRARY_KEY, value); window.dispatchEvent(new Event('s2ui-library-change'));
}
export function materializeLibrary(code: string, library = components()): string {
 if (!code.includes('@sketch2ui/library')) return code;
 const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
 const bindings: string[] = [];
 const kept = ast.program.body.filter(n => {
  if (!t.isImportDeclaration(n) || n.source.value !== '@sketch2ui/library') return true;
  for (const spec of n.specifiers) {
   if (!t.isImportSpecifier(spec) || !t.isIdentifier(spec.imported)) throw new Error('Use named library imports.');
   const item = library.find(c => c.name === (spec.imported as t.Identifier).name);
   if (!item) throw new Error(`Missing library component: ${spec.imported.name}`);
   validateComponent(item);
   const tree = parse(item.code, { sourceType: 'module', plugins: ['jsx'] });
   const lines: string[] = [];
   let returned = '';
   for (const node of tree.program.body) {
    if (t.isImportDeclaration(node)) {
     const namespace = node.source.value === 'react' ? '__s2ui_libReact' : '__s2ui_libIcons';
     for (const s of node.specifiers) lines.push(`const ${s.local.name} = ${t.isImportSpecifier(s) ? `${namespace}[${JSON.stringify(t.isIdentifier(s.imported) ? s.imported.name : s.imported.value)}]` : namespace};`);
    } else if (t.isExportDefaultDeclaration(node)) {
     const decl = node.declaration;
     if (t.isFunctionDeclaration(decl)) { const name = decl.id?.name || '__Reusable'; lines.push(generate({ ...decl, id: t.identifier(name) }).code); returned = `return ${name};`; }
     else returned = `return (${generate(decl).code});`;
    } else lines.push(generate(node).code);
   }
   lines.push(returned);
   bindings.push(`const ${spec.local.name} = (() => { ${lines.join('\n')} })();`);
  }
  return false;
 });
 return `import * as __s2ui_libReact from 'react';\nimport * as __s2ui_libIcons from 'lucide-react';\n${bindings.join('\n')}\n${generate({ ...ast, program: { ...ast.program, body: kept } }).code}`;
}
export function libraryPrompt() {
 const list = components();
 return list.length ? `\nREUSABLE COMPONENT LIBRARY: import named components from '@sketch2ui/library'. These imports are resolved by the editor and export. Prefer these shared components; do not copy their implementations.\n${list.map(c => `${c.name}: ${c.description}\n${c.code}`).join('\n')}\n` : '';
}
