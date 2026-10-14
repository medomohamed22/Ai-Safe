import { parse } from '@babel/parser';
import generate from '@babel/generator';
import * as t from '@babel/types';

export interface ElementEdit {
  text?: string;
  color?: string;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
}

function sourceTree(code: string) {
  return parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
}

function elements(tree: t.File) {
  const nodes: t.JSXElement[] = [];
  t.traverseFast(tree, (node) => {
    if (t.isJSXElement(node) && t.isJSXIdentifier(node.openingElement.name) && /^[a-z]/.test(node.openingElement.name.name)) nodes.push(node);
  });
  return nodes;
}

export function describeElement(code: string, id: number) {
  const node = elements(sourceTree(code))[id];
  if (!node) throw new Error('This element is no longer available. Select it again.');
  const editableText = node.children.length > 0 && node.children.every((child) => t.isJSXText(child) || (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)));
  return { tag: (node.openingElement.name as t.JSXIdentifier).name, editableText,
    text: editableText ? node.children.map((child) => t.isJSXText(child) ? child.value : ((child as t.JSXExpressionContainer).expression as t.StringLiteral).value).join('').trim() : '',
    snippet: generate(node).code };
}

export function instrumentPreview(code: string) {
  const tree = sourceTree(code);
  elements(tree).forEach((node, id) => {
    node.openingElement.attributes = node.openingElement.attributes.filter((attr) => !(t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'data-s2ui-id' })));
    node.openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-s2ui-id'), t.stringLiteral(String(id))));
  });
  return generate(tree).code;
}

export function assertLockedElements(code: string, locks: string[]) {
  if (!locks.length) return;
  const available = elements(sourceTree(code)).map(node => generate(node).code);
  for (const locked of locks) {
    const index = available.indexOf(locked);
    if (index < 0) throw new Error('A locked element was changed. The current code was kept. Unlock it before editing or regenerating it.');
    available.splice(index, 1);
  }
}

export function lockPrompt(locks: string[]) {
  return locks.length ? `\nLOCKED JSX: preserve these elements exactly, including their children, properties and handlers. Do not delete or rewrite them:\n${locks.join('\n\n')}\n` : '';
}

export function applyElementEdit(code: string, id: number, edit: ElementEdit) {
  const tree = sourceTree(code);
  const node = elements(tree)[id];
  if (!node) throw new Error('This element is no longer available. Select it again.');
  if (edit.text !== undefined) {
    if (!describeElement(code, id).editableText) throw new Error('Dynamic or nested text must be edited with AI to preserve its behavior.');
    node.children = [t.jsxExpressionContainer(t.stringLiteral(edit.text))];
  }
  const properties: t.ObjectProperty[] = [];
  for (const key of ['color', 'backgroundColor', 'padding', 'borderRadius'] as const) {
    const value = edit[key];
    if (value === undefined) continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value > 200) throw new Error('Spacing must be between 0 and 200 pixels.');
    } else if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Choose a valid color.');
    properties.push(t.objectProperty(t.identifier(key), typeof value === 'number' ? t.numericLiteral(value) : t.stringLiteral(value)));
  }
  if (properties.length) {
    const attributes = node.openingElement.attributes;
    const existing = attributes.find((attr): attr is t.JSXAttribute => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'style' }));
    const value = existing?.value;
    const original = t.isJSXExpressionContainer(value) && t.isExpression(value.expression) ? value.expression : undefined;
    const merged = t.objectExpression([...(original ? [t.spreadElement(original)] : []), ...properties]);
    node.openingElement.attributes = attributes.filter((attr) => attr !== existing);
    node.openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(merged)));
  }
  return generate(tree).code;
}
