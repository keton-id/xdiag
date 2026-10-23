/**
 * parse.ts
 * Mermaid-compatible subset of mindmaps. Indentation is the hierarchy:
 *
 *   mindmap
 *     root((xdiag))
 *       Editor
 *         CodeMirror
 *       Canvas
 *         React Flow
 *
 * Node shapes: `[rect]`, `(rounded)`, `((circle))`, `))bang((`, `)cloud(`.
 * Anything else is a plain rounded node.
 */

import { DiagramParseError, type MindModel, type MindNode, type MindShape } from '../types';

const SHAPES: Array<{ open: string; close: string; shape: MindShape }> = [
  { open: '((', close: '))', shape: 'circle' },
  { open: '))', close: '((', shape: 'bang' },
  { open: ')', close: '(', shape: 'cloud' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'rounded' },
];

function decode(raw: string): { label: string; shape: MindShape } {
  // Mermaid prefixes shapes with an id: `root((xdiag))`, `a[rect]`.
  const id = raw.match(/^[\w$.-]+(?=[([)])/);
  const body = id ? raw.slice(id[0].length) : raw;
  for (const { open, close, shape } of SHAPES) {
    if (body.startsWith(open) && body.endsWith(close) && body.length >= open.length + close.length) {
      return { label: body.slice(open.length, body.length - close.length).trim(), shape };
    }
  }
  return { label: raw.trim(), shape: 'rounded' };
}

export function parseMindmap(source: string): MindModel {
  const lines = source.split('\n');
  let seenHeader = false;
  let root: MindNode | null = null;
  // stack[d] is the nearest ancestor at indentation depth d.
  const stack: MindNode[] = [];
  const depths: number[] = [];
  let counter = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('%%')) continue;

    if (!seenHeader) {
      if (raw.trim() !== 'mindmap') {
        throw new DiagramParseError('Mindmaps must start with "mindmap"', lineNo);
      }
      seenHeader = true;
      continue;
    }

    const indent = raw.length - raw.trimStart().length;
    const decoded = decode(raw.trim());
    if (!decoded.label) throw new DiagramParseError('Empty mindmap node', lineNo);

    const node: MindNode = { id: `n${counter++}`, label: decoded.label, shape: decoded.shape, children: [] };

    if (!root) {
      root = node;
      stack.push(node);
      depths.push(indent);
      continue;
    }

    if (indent <= depths[0]) {
      throw new DiagramParseError('Mindmaps allow exactly one root node', lineNo);
    }

    while (depths.length > 1 && depths[depths.length - 1] >= indent) {
      depths.pop();
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    parent.children.push(node);
    stack.push(node);
    depths.push(indent);
  }

  if (!root) throw new DiagramParseError('Mindmaps must start with "mindmap"', 1);
  return { root };
}
