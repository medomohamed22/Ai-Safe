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
  'You edit exactly ONE JSX element in an existing React + Tailwind app. The rest of the file is never shown to the user as changed, so your replacement must be complete and self-contained for that element.',
  'Rules:',
  '- Reply with ONLY the replacement JSX for the element: one single JSX element, no explanations, no markdown fences, no surrounding code.',
  '- Preserve the element\'s existing behavior, handlers, and children unless the requested change says otherwise.',
  '- You may add inline handlers and use state, setters, props, and imports that already exist in the provided context. Do NOT invent new imports, new top-level state, or identifiers that are not in the context.',
  '- Keep the same root tag unless the change clearly requires a different one.',
  '- If the change cannot be contained inside this element (it needs new page-level state, a new component, a route, or edits to other elements), reply with ONLY this JSON: {"escalate": "<one short reason>"}',
].join('\n');

export function elementAgentPrompt(ctx: ElementContext, instruction: string): string {
  return [
    '## Element to edit — return a replacement for this JSX, and only this JSX',
    '```jsx',
    ctx.snippet,
    '```',
    ctx.parentSnippet ? `\n## Its parent element (context only — never return it)\n\`\`\`jsx\n${ctx.parentSnippet}\n\`\`\`` : '',
    ctx.head ? `\n## Component head — imports and declarations above the element (context only)\n\`\`\`jsx\n${ctx.head}\n\`\`\`` : '',
    `\n## Requested change\n${instruction}`,
  ].filter(Boolean).join('\n');
}

export type AgentReply = { kind: 'edit'; jsx: string } | { kind: 'escalate'; reason: string };

export function parseAgentReply(text: string): AgentReply {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json|jsx|tsx|javascript)?\s*([\s\S]*?)```/);
  const body = (fence ? fence[1] : trimmed).trim();
  if (body.startsWith('{')) {
    try {
      const j = JSON.parse(body);
      if (typeof j?.escalate === 'string' && j.escalate) return { kind: 'escalate', reason: j.escalate };
      if (typeof j?.jsx === 'string' && j.jsx.trim()) return { kind: 'edit', jsx: j.jsx.trim() };
    } catch { /* not JSON after all — fall through to the JSX slice */ }
  }
  const start = body.indexOf('<');
  const end = body.lastIndexOf('>');
  if (start >= 0 && end > start) return { kind: 'edit', jsx: body.slice(start, end + 1).trim() };
  throw new Error('The agent did not return a usable edit. Your page was not changed.');
}

export function applyElementReplacement(code: string, id: number, jsx: string, locks: string[] = []): string {
  const ctx = elementContext(code, id);
  let frag;
  try {
    frag = parse(`<>${jsx}</>`, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch (e) {
    throw new Error(`The edited element is not valid JSX: ${(e as Error).message}`);
  }
  const stmt = frag.program.body[0];
  const expr = stmt && t.isExpressionStatement(stmt) ? stmt.expression : null;
  const children = expr && t.isJSXFragment(expr) ? expr.children.filter((c) => !(t.isJSXText(c) && !c.value.trim())) : [];
  if (children.length !== 1 || !t.isJSXElement(children[0])) throw new Error('The edit must be exactly one JSX element. Your page was not changed.');
  const next = code.slice(0, ctx.start) + jsx.trim() + code.slice(ctx.end);
  sourceTree(next); // a splice that breaks the file is a failed edit, never a saved one
  assertLockedElements(next, locks);
  const failed = sourceChecks(next).filter((c) => !c.passed);
  if (failed.length) throw new Error(`The edit failed verification (${failed.map((c) => c.name).join(', ')}). Your page was not changed.`);
  return next;
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
