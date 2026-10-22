import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { sourceChecks } from './quality';
import { assertLockedElements, elements, sourceTree } from './visualEdit';

// ---------------------------------------------------------------------------------------------
// Element Agent — surgical edits to ONE selected element.
//
// The full-generation path rewrites the whole page for every request, which
// is slow, expensive, and keeps drifting unrelated parts of the design. The
// agent path works like a small coding agent instead:
//   Read   — locate the selected element's exact source range and gather
//            its context (parent element, imports, component head/state).
//   Edit   — the model returns ONLY the replacement JSX for that element.
//   Verify — the replacement is spliced into the untouched source, the file
//            is re-parsed, locked elements are asserted and the standard
//            source checks must pass. One failed verification earns the
//            agent a single repair pass with the error fed back.
// If the change genuinely cannot live inside the element (a new page-level
// state container, a route, a shared layout change), the model answers with
// an escalation and the page is left untouched so the user can choose the
// full regeneration themselves.
// ---------------------------------------------------------------------------------------------

export interface ElementContext {
  tag: string;
  snippet: string;
  start: number;
  end: number;
  parentSnippet: string;
  head: string;
}

export function elementContext(code: string, id: number): ElementContext {
  const ast = sourceTree(code);
  const list = elements(ast);
  const node = list[id];
  if (!node || node.start == null || node.end == null) throw new Error('This element is no longer available. Select it again.');
  const start = node.start;
  const end = node.end;
  const snippet = code.slice(start, end);
  const parent = list
    .filter((n) => n !== node && n.start != null && n.end != null && n.start <= start && n.end >= end)
    .sort((a, b) => (a.end! - a.start!) - (b.end! - b.start!))[0];
  const parentSnippet = parent ? code.slice(parent.start!, Math.min(parent.end!, parent.start! + 1200)) : '';
  const imports = ast.program.body.filter(t.isImportDeclaration).map((n) => code.slice(n.start!, n.end!)).join('\n');
  const host = ast.program.body.find((n) => n.start != null && n.end != null && n.start <= start && n.end >= end);
  const hostHead = host && host.start != null ? code.slice(host.start, Math.min(start, host.start + 1600)) : '';
  const head = [imports, hostHead].filter(Boolean).join('\n');
  return { tag: (node.openingElement.name as t.JSXIdentifier).name, snippet, start, end, parentSnippet, head };
}

export const ELEMENT_AGENT_SYSTEM = [
  'You are a surgical code editor inside Sketch2UI, a sketch-to-UI studio.',
  'You edit exactly ONE JSX element in an existing React + Tailwind app. Everything outside that element stays byte-identical, except for ONE state declaration the system can add to the element\'s component for you (see B).',
  'Reply protocol — choose ONE form, with no explanations and no markdown fences:',
  'A) Visual or content change: reply with ONLY the replacement JSX. One root element, or a fragment <>...</> when the element needs a sibling of its own (its popup, its backdrop).',
  'B) The change needs new local state (open/closed, toggles, selected tab, counters): reply with ONLY this JSON: {"replace": "<the replacement JSX>", "addState": "const [open, setOpen] = useState(false);"}',
  '   - addState is exactly ONE const declaration using useState or useRef. It is inserted into the component that contains the element, and a missing React hook import is added for you. Use fresh state names that do not appear in the context.',
  '   - The replacement may use the new state names.',
  'Behavior patterns — follow them; they are how behavior is added correctly here:',
  '   - Dropdown / menu / popover: wrap the element in a relatively positioned container and render the menu INSIDE the replacement, conditional on the new state. Example: {"replace": "<div className=\"relative\"><button onClick={() => setOpen(!open)} aria-expanded={open}>Menu</button>{open && (<div className=\"absolute right-0 top-full z-50\">...</div>)}</div>", "addState": "const [open, setOpen] = useState(false);"}',
  '   - Panel / page / sheet that OPENS (statistics, details, settings, a cart): render it as an OVERLAY next to the trigger inside one fragment — {open && (<div className="fixed inset-0 z-50 overflow-y-auto bg-white">...a header row with a close button that sets the state back to false...</div>)} — never as a column or section in the page flow.',
  '   - Modal / dialog: the same overlay rule — fixed inset-0 z-50 with a dimmed backdrop, the dialog centered inside it, and a close control, driven by one boolean state.',
  '   - Toggle / show-hide of content that belongs in the layout: one boolean state plus conditional rendering or a conditional class.',
  'HARD RULE for anything that OPENS: opened content is positioned fixed or absolute and layered above the page (z-50), and it always carries its own close control. It must NEVER be a normal-flow sibling or column — that squeezes the existing layout into a broken half-page, especially at phone widths.',
  'Rules:',
  '- Preserve the element\'s existing behavior, handlers, and children unless the requested change says otherwise.',
  '- Use ONLY identifiers that exist in the provided context, your addState names, or names the replacement itself declares. The edit is machine-checked for undefined names and rejected if any slip in.',
  '- Do NOT invent imports or top-level code, and do not reference state you did not declare via addState.',
  '- Keep the same root tag unless the change clearly requires a wrapper or a different tag.',
  '- If the change cannot be contained this way (a new route, a new shared component, page-level layout), reply with ONLY this JSON: {"escalate": "<one short reason>"}',
].join('\n');

export function elementAgentPrompt(ctx: ElementContext, instruction: string): string {
  return [
    '## Element to edit — reply per your protocol: the replacement JSX, or the JSON form when the change needs new state',
    '```jsx',
    ctx.snippet,
    '```',
    ctx.parentSnippet ? `\n## Its parent element (context only — never return it)\n\`\`\`jsx\n${ctx.parentSnippet}\n\`\`\`` : '',
    ctx.head ? `\n## Component head — imports and declarations above the element (context only)\n\`\`\`jsx\n${ctx.head}\n\`\`\`` : '',
    `\n## Requested change\n${instruction}`,
  ].filter(Boolean).join('\n');
}

export const ELEMENT_AGENT_INSERT_SYSTEM = [
  'You are a surgical code editor inside Sketch2UI, a sketch-to-UI studio.',
  'You add exactly ONE new JSX element inside an existing container element of a React + Tailwind app. Everything else stays byte-identical, except for ONE state declaration the system can add to the component for you (see B).',
  'Reply protocol — choose ONE form, with no explanations and no markdown fences:',
  'A) Plain addition: reply with ONLY the new JSX (one root element, or a fragment <>...</> when the addition is a small group). Do NOT repeat the container or its existing children.',
  'B) The addition needs its own local state (an interactive widget: accordion, tabs, toggle, counter): reply with ONLY this JSON: {"replace": "<the new JSX>", "addState": "const [open, setOpen] = useState(false);"} — addState is exactly ONE const declaration using useState or useRef, inserted into the component for you with any missing React hook import added; use fresh names.',
  'Rules:',
  '- Match the design language of the container\'s existing children: the same spacing, radius, typography, and color habits.',
  '- Use ONLY identifiers that exist in the provided context, your addState names, or names the new element itself declares. The edit is machine-checked for undefined names.',
  '- Do NOT invent imports or top-level code.',
  '- If the addition cannot live as a child of this container (a new route, a new shared component, page-level structure), reply with ONLY this JSON: {"escalate": "<one short reason>"}',
].join('\n');

export function elementInsertPrompt(ctx: ElementContext, instruction: string): string {
  const container = ctx.snippet.length > 2400 ? ctx.snippet.slice(0, 2400) + '\n/* …container continues… */' : ctx.snippet;
  return [
    '## Container element — the new element goes INSIDE this one, as its last child. Return only the new element',
    '```jsx',
    container,
    '```',
    ctx.head ? `\n## Component head — imports and declarations above the element (context only)\n\`\`\`jsx\n${ctx.head}\n\`\`\`` : '',
    `\n## What to add\n${instruction}`,
  ].filter(Boolean).join('\n');
}

export type AgentReply = { kind: 'edit'; jsx: string; addState?: string } | { kind: 'escalate'; reason: string };

export function parseAgentReply(text: string): AgentReply {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json|jsx|tsx|javascript)?\s*([\s\S]*?)```/);
  const body = (fence ? fence[1] : trimmed).trim();
  if (body.startsWith('{')) {
    try {
      const j = JSON.parse(body);
      if (typeof j?.escalate === 'string' && j.escalate) return { kind: 'escalate', reason: j.escalate };
      const addState = typeof j?.addState === 'string' && j.addState.trim() ? j.addState.trim() : undefined;
      if (typeof j?.replace === 'string' && j.replace.trim()) return { kind: 'edit', jsx: j.replace.trim(), addState };
      if (typeof j?.jsx === 'string' && j.jsx.trim()) return { kind: 'edit', jsx: j.jsx.trim(), addState };
    } catch { /* not JSON after all — fall through to the JSX slice */ }
  }
  const start = body.indexOf('<');
  const end = body.lastIndexOf('>');
  if (start >= 0 && end > start) return { kind: 'edit', jsx: body.slice(start, end + 1).trim() };
  throw new Error('The agent did not return a usable edit. Your page was not changed.');
}

function assertSingleRoot(jsx: string): void {
  let frag;
  try {
    frag = parse(`<>${jsx}</>`, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch (e) {
    throw new Error(`The edited element is not valid JSX: ${(e as Error).message}`);
  }
  const stmt = frag.program.body[0];
  const expr = stmt && t.isExpressionStatement(stmt) ? stmt.expression : null;
  const children = expr && t.isJSXFragment(expr) ? expr.children.filter((c) => !(t.isJSXText(c) && !c.value.trim())) : [];
  if (children.length !== 1 || !(t.isJSXElement(children[0]) || t.isJSXFragment(children[0]))) throw new Error('The edit must be exactly one JSX element (a fragment wrapping it is fine). Your page was not changed.');
}

function verifySpliced(next: string, locks: string[]): void {
  sourceTree(next); // a splice that breaks the file is a failed edit, never a saved one
  assertLockedElements(next, locks);
  const failed = sourceChecks(next).filter((c) => !c.passed);
  if (failed.length) throw new Error(`The edit failed verification (${failed.map((c) => c.name).join(', ')}). Your page was not changed.`);
}

// --- v3: behavior edits -------------------------------------------------
// A behavior change ("make this button open a menu") cannot live inside
// the element alone: it needs state in the host component and often a
// wrapper + a conditional sibling. The agent therefore returns the
// replacement plus ONE state declaration (addState); the system inserts
// that declaration into the host component, adds a missing React hook
// import mechanically, and machine-checks every name the replacement
// references — an edit naming undeclared state used to save silently and
// explode only at runtime in the preview.

type AstNode = any;

function walkNodes(node: AstNode, fn: (n: AstNode, parent: AstNode, key: string) => void, parent: AstNode = null, key = ''): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((c) => walkNodes(c, fn, parent, key)); return; }
  if (typeof node.type === 'string') fn(node, parent, key);
  for (const [k, v] of Object.entries(node)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === '__clone') continue;
    walkNodes(v, fn, node, k);
  }
}

function patternNodes(pattern: AstNode, out: Set<AstNode>): void {
  walkNodes(pattern, (n) => { if (n.type === 'Identifier') out.add(n); });
}

function patternNames(pattern: AstNode, out: Set<string>): void {
  const nodes = new Set<AstNode>();
  patternNodes(pattern, nodes);
  nodes.forEach((n) => out.add(n.name));
}

// Names visible to the element: module imports + top-level declarations +
// everything declared inside the host component (its params, hooks, vars).
function collectDeclaredNames(ast: ReturnType<typeof sourceTree>, host: AstNode): Set<string> {
  const names = new Set<string>();
  for (const stmt of ast.program.body) {
    if (t.isImportDeclaration(stmt)) stmt.specifiers.forEach((sp) => names.add(sp.local.name));
    if (t.isVariableDeclaration(stmt)) stmt.declarations.forEach((d) => patternNames(d.id, names));
    if ((t.isFunctionDeclaration(stmt) || t.isClassDeclaration(stmt)) && stmt.id) names.add(stmt.id.name);
    const decl = (t.isExportNamedDeclaration(stmt) || t.isExportDefaultDeclaration(stmt)) ? stmt.declaration : null;
    if (decl && t.isVariableDeclaration(decl)) decl.declarations.forEach((d) => patternNames(d.id, names));
    if (decl && (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) && decl.id) names.add(decl.id.name);
  }
  if (host) walkNodes(host, (n) => {
    if (t.isVariableDeclarator(n)) patternNames(n.id, names);
    if (t.isFunctionDeclaration(n) || t.isFunctionExpression(n) || t.isArrowFunctionExpression(n)) { if ((n as any).id) names.add((n as any).id.name); n.params.forEach((p: AstNode) => patternNames(p, names)); }
    if (t.isClassDeclaration(n) && n.id) names.add(n.id.name);
  });
  return names;
}

const GLOBAL_NAMES = new Set(['React', 'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Promise', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'fetch', 'alert', 'window', 'document', 'localStorage', 'sessionStorage', 'URL', 'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN']);

// Identifiers the replacement USES but does not itself declare.
function freeReferences(program: AstNode): Set<string> {
  const bound = new Set<AstNode>();
  walkNodes(program, (n) => {
    if (t.isVariableDeclarator(n)) patternNodes(n.id, bound);
    if (t.isFunctionDeclaration(n) || t.isFunctionExpression(n) || t.isArrowFunctionExpression(n)) { if ((n as any).id) bound.add((n as any).id); n.params.forEach((p: AstNode) => patternNodes(p, bound)); }
    if (t.isClassDeclaration(n) && n.id) bound.add(n.id);
    if (t.isImportSpecifier(n) || t.isImportDefaultSpecifier(n) || t.isImportNamespaceSpecifier(n)) bound.add(n.local);
  });
  const boundNames = new Set<string>();
  bound.forEach((n) => boundNames.add(n.name));
  const refs = new Set<string>();
  walkNodes(program, (n, parent, key) => {
    if (n.type === 'Identifier') {
      if (bound.has(n)) return;
      if (parent && parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return;
      if (parent && parent.type === 'ObjectProperty' && key === 'key' && !parent.computed) return;
      if (parent && parent.type === 'ObjectMethod' && key === 'key' && !parent.computed) return;
      refs.add(n.name);
    }
    if (n.type === 'JSXIdentifier' && parent) {
      const tagName = (parent.type === 'JSXOpeningElement' || parent.type === 'JSXClosingElement') && key === 'name';
      const memberRoot = parent.type === 'JSXMemberExpression' && key === 'object';
      if ((tagName || memberRoot) && /^[A-Z]/.test(n.name)) refs.add(n.name);
    }
  });
  return new Set([...refs].filter((r) => !boundNames.has(r)));
}

function parseAddState(addState: string): { names: string[]; hooks: string[]; text: string } {
  let prog;
  try {
    prog = parse(addState, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch {
    throw new Error('The added state is not valid code. Your page was not changed.');
  }
  const body = prog.program.body;
  if (body.length !== 1 || !t.isVariableDeclaration(body[0]) || body[0].kind !== 'const') throw new Error('Added state must be exactly one const declaration using useState or useRef. Your page was not changed.');
  const names = new Set<string>();
  const hooks = new Set<string>();
  for (const d of body[0].declarations) {
    patternNames(d.id, names);
    if (!t.isCallExpression(d.init) || !t.isIdentifier(d.init.callee) || !['useState', 'useRef'].includes(d.init.callee.name)) throw new Error('Added state must be exactly one const declaration using useState or useRef. Your page was not changed.');
    hooks.add(d.init.callee.name);
  }
  return { names: [...names], hooks: [...hooks], text: addState.trim() };
}

function ensureReactHook(code: string, hook: string): string {
  const ast = sourceTree(code);
  const imp = ast.program.body.find((n): n is t.ImportDeclaration => t.isImportDeclaration(n) && n.source.value === 'react');
  if (!imp || imp.start == null || imp.end == null) return `import { ${hook} } from 'react';\n` + code;
  if (imp.specifiers.some((sp) => t.isImportSpecifier(sp) && sp.imported.type === 'Identifier' && sp.imported.name === hook)) return code;
  const named = imp.specifiers.filter(t.isImportSpecifier);
  if (named.length) { const last = named[named.length - 1]; return code.slice(0, last.end!) + `, ${hook}` + code.slice(last.end!); }
  const def = imp.specifiers.find(t.isImportDefaultSpecifier);
  if (def && def.end != null) return code.slice(0, def.end) + `, { ${hook} }` + code.slice(def.end);
  return code.slice(0, imp.end) + `\nimport { ${hook} } from 'react';` + code.slice(imp.end);
}

function hostFunction(host: AstNode): AstNode {
  let fn: AstNode = host;
  if (fn && (t.isExportDefaultDeclaration(fn) || t.isExportNamedDeclaration(fn))) fn = fn.declaration;
  if (fn && t.isVariableDeclaration(fn)) fn = fn.declarations[0]?.init;
  if (fn && (t.isFunctionDeclaration(fn) || t.isFunctionExpression(fn) || t.isArrowFunctionExpression(fn)) && t.isBlockStatement(fn.body)) return fn;
  return null;
}

export interface AgentEdit {
  jsx: string;
  addState?: string;
}

// The agent edit engine (v3). mode 'edit' replaces the element at id;
// mode 'insert' adds the reply as the element's last child. Verification:
// single root, no undefined names, valid addState with fresh names, the
// spliced file re-parses, locked elements intact, source checks green.
export function applyAgentEdit(code: string, id: number, edit: AgentEdit, locks: string[] = [], mode: 'edit' | 'insert' = 'edit'): string {
  const ctx = elementContext(code, id);
  assertSingleRoot(edit.jsx);
  const ast = sourceTree(code);
  const node = elements(ast)[id];
  const host = ast.program.body.find((n) => n.start != null && n.end != null && n.start <= ctx.start && n.end >= ctx.end);
  const declared = collectDeclaredNames(ast, host);
  const state = edit.addState ? parseAddState(edit.addState) : null;
  if (state) for (const name of state.names) {
    if (declared.has(name)) throw new Error(`The state name "${name}" already exists in this component. Your page was not changed.`);
  }
  const frag = parse(`<>${edit.jsx}</>`, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const allowed = new Set([...declared, ...(state ? state.names : [])]);
  const missing = [...freeReferences(frag)].filter((n) => !allowed.has(n) && !GLOBAL_NAMES.has(n)).sort();
  if (missing.length) throw new Error(`The edit uses names that do not exist here: ${missing.join(', ')}. Declare state via addState or use names from the context. Your page was not changed.`);
  let next: string;
  if (mode === 'insert') {
    if (!node || !t.isJSXElement(node) || node.openingElement.selfClosing || !node.closingElement || node.closingElement.start == null) {
      throw new Error('This element cannot contain children. Select its parent container and add the element there.');
    }
    const insertAt = node.closingElement.start;
    const before = code.slice(0, insertAt);
    const lineStart = before.lastIndexOf('\n') + 1;
    const closingIndent = before.slice(lineStart);
    const insertion = /^\s*$/.test(closingIndent) ? `  ${edit.jsx.trim()}\n${closingIndent}` : edit.jsx.trim();
    next = before + insertion + code.slice(insertAt);
  } else {
    next = code.slice(0, ctx.start) + edit.jsx.trim() + code.slice(ctx.end);
  }
  if (state) {
    for (const hook of state.hooks) next = ensureReactHook(next, hook);
    const needle = edit.jsx.trim().slice(0, 60);
    const pos = next.indexOf(needle);
    const ast2 = sourceTree(next);
    const host2 = ast2.program.body.find((n) => n.start != null && n.end != null && pos >= 0 && n.start <= pos && n.end >= pos)
      || ast2.program.body.find((n) => n.start != null && n.end != null && n.start <= ctx.start && n.end >= ctx.end);
    const fn = hostFunction(host2);
    if (!fn) throw new Error('Could not find the component to hold the new state. Your page was not changed.');
    const body = fn.body as t.BlockStatement;
    let anchor = body.start! + 1;
    for (const stmt of body.body) {
      if (t.isVariableDeclaration(stmt) && stmt.declarations.some((d) => t.isCallExpression(d.init) && t.isIdentifier(d.init.callee) && /^(useState|useRef|useMemo|useCallback)$/.test(d.init.callee.name))) anchor = stmt.end!;
    }
    let indent = '  ';
    const firstStmt = body.body[0];
    if (firstStmt && firstStmt.start != null) {
      const ls = next.lastIndexOf('\n', firstStmt.start) + 1;
      const ind = next.slice(ls, firstStmt.start);
      if (/^\s*$/.test(ind)) indent = ind;
    }
    next = next.slice(0, anchor) + `\n${indent}${state.text}` + next.slice(anchor);
  }
  verifySpliced(next, locks);
  return next;
}

export function applyElementReplacement(code: string, id: number, jsx: string, locks: string[] = []): string {
  return applyAgentEdit(code, id, { jsx }, locks, 'edit');
}

// Insert a NEW element as the last child of the selected container, with
// the same verification contract as a replacement: one root node, no
// undefined names, re-parsed file, locked elements intact, source checks
// green. A self-closing element cannot be a container — say so plainly.
export function applyElementInsert(code: string, parentId: number, jsx: string, locks: string[] = []): string {
  return applyAgentEdit(code, parentId, { jsx }, locks, 'insert');
}

export function countChangedLines(a: string, b: string): number {
  const counts = new Map<string, number>();
  const aa = a.split('\n');
  const bb = b.split('\n');
  for (const line of aa) counts.set(line, (counts.get(line) || 0) + 1);
  let matched = 0;
  for (const line of bb) {
    const n = counts.get(line) || 0;
    if (n > 0) { counts.set(line, n - 1); matched++; }
  }
  return (aa.length - matched) + (bb.length - matched);
}
