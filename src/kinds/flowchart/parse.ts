/**
 * parse.ts
 * Mermaid-compatible subset of flowcharts:
 *
 *   flowchart LR
 *     A[Start] --> B{Decision}
 *     B -->|yes| C[Ship]
 *     B -.-> D[Skip]
 *
 * Node shapes: `[rect]`, `(round)`, `{diamond}`, `((circle))`.
 * Edges: `-->`, `---`, `-.->`, `==>`, optionally labelled with `|label|`
 * or `-- label -->`. Chain syntax (`A --> B --> C`) declares each node.
 */

import {
  DiagramParseError,
  type FlowDirection,
  type FlowModel,
  type FlowNode,
  type FlowShape,
} from '../types';

const HEADER = /^(?:flowchart|graph)\s+(LR|TB|RL|BT)\s*$/;
const NODE_DEF = /^([\w$]+)\s*(\(\(([^)]*)\)\)|\{([^}]*)\}|\(([^)]*)\)|\[([^\]]*)\])?/;
const EDGE_OP = /^(==>|-.->|-->|---|--|==)/;

function shapeOf(def: string | undefined): FlowShape | null {
  if (!def) return null;
  if (def.startsWith('((')) return 'circle';
  if (def.startsWith('{')) return 'diamond';
  if (def.startsWith('(')) return 'round';
  return 'rect';
}

function labelOf(def: string | undefined): string | null {
  if (!def) return null;
  if (def.startsWith('((')) return def.slice(2, -2).trim();
  if (def.startsWith('{')) return def.slice(1, -1).trim();
  if (def.startsWith('(')) return def.slice(1, -1).trim();
  return def.slice(1, -1).trim();
}

interface EdgeStyle {
  dashed: boolean;
  thick: boolean;
  arrow: boolean;
}

function styleOf(op: string): EdgeStyle {
  return {
    dashed: op.includes('.'),
    thick: op.startsWith('=='),
    arrow: op.endsWith('>'),
  };
}

export function parseFlowchart(source: string): FlowModel {
  const lines = source.split('\n');
  let direction: FlowDirection | null = null;
  const nodes: FlowNode[] = [];
  const index = new Map<string, FlowNode>();
  const edges: FlowModel['edges'] = [];

  const declare = (id: string, def?: string) => {
    const shape = shapeOf(def);
    const label = labelOf(def);
    const existing = index.get(id);
    if (existing) {
      if (shape) existing.shape = shape;
      if (label !== null && label !== '') existing.label = label;
      return;
    }
    const node: FlowNode = { id, label: label || id, shape: shape ?? 'rect' };
    nodes.push(node);
    index.set(id, node);
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (!direction) {
      const head = trimmed.match(HEADER);
      if (!head) throw new DiagramParseError('Flowcharts must start with "flowchart <dir>"', lineNo);
      direction = head[1] as FlowDirection;
      continue;
    }

    // subgraph/end are accepted as grouping noise; they do not affect layout.
    if (/^subgraph\b/.test(trimmed) || trimmed === 'end' || /^style\b/.test(trimmed)) continue;

    let rest = trimmed;
    let cursor = rest.match(NODE_DEF);
    if (!cursor) throw new DiagramParseError(`Unrecognised flowchart statement: ${trimmed}`, lineNo);
    declare(cursor[1], cursor[2]);
    const firstId = cursor[1];
    rest = rest.slice(cursor[0].length).trim();

    let previous = firstId;
    while (rest) {
      // Labels sit either side of the arrow: `A -- yes --> B` or `A -->|yes| B`.
      let label = '';
      let op: string;
      const inline = rest.match(/^--\s+([^->][^>]*?)\s+(==>|-.->|-->|---)\s*/);
      if (inline) {
        label = inline[1].trim();
        op = inline[2];
        rest = rest.slice(inline[0].length);
      } else {
        const arrow = rest.match(EDGE_OP);
        if (!arrow) throw new DiagramParseError(`Expected an arrow near "${rest}"`, lineNo);
        op = arrow[0];
        rest = rest.slice(op.length).trim();

        const after = rest.match(/^\|([^|]*)\|\s*/);
        if (after) {
          label = after[1].trim();
          rest = rest.slice(after[0].length);
        }
      }

      const next = rest.match(NODE_DEF);
      if (!next) throw new DiagramParseError(`Expected a node after "${op}"`, lineNo);
      declare(next[1], next[2]);
      rest = rest.slice(next[0].length).trim();

      edges.push({ from: previous, to: next[1], label, ...styleOf(op) });
      previous = next[1];
    }
  }

  if (!direction) throw new DiagramParseError('Flowcharts must start with "flowchart <dir>"', 1);

  return { direction, nodes, edges };
}
