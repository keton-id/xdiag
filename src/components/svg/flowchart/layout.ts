/**
 * layout.ts
 * Layered layout for flowcharts: longest-path ranking, one barycenter pass to
 * reduce crossings, then node boxes and edge routes. Pure geometry.
 */

import type { FlowModel, FlowNode } from '../../../kinds/types';

const CHAR_W = 7.2;
const NODE_H = 44;
const RANK_GAP = 78;
const SIBLING_GAP = 30;
const MARGIN = 40;

export interface PlacedNode extends FlowNode {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoutedEdge {
  d: string;
  label: string;
  labelX: number;
  labelY: number;
  dashed: boolean;
  thick: boolean;
  arrow: boolean;
  x: number;
  y: number;
  angle: number;
}

export interface FlowLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: RoutedEdge[];
}

function measure(node: FlowNode): { w: number; h: number } {
  const textW = node.label.length * CHAR_W;
  switch (node.shape) {
    case 'diamond':
      return { w: Math.max(120, textW * 1.7 + 30), h: Math.max(76, NODE_H + 26) };
    case 'circle':
      return { w: Math.max(88, textW + 36), h: Math.max(88, textW + 36) };
    case 'round':
      return { w: Math.max(96, textW + 44), h: NODE_H };
    default:
      return { w: Math.max(96, textW + 40), h: NODE_H };
  }
}

/** Longest-path rank; back edges are ignored once their target is on the stack. */
function ranks(model: FlowModel): Map<string, number> {
  const out = new Map<string, string[]>();
  for (const n of model.nodes) out.set(n.id, []);
  for (const e of model.edges) out.get(e.from)?.push(e.to);

  const rank = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let best = 0;
    for (const next of out.get(id) ?? []) best = Math.max(best, visit(next) + 1);
    visiting.delete(id);
    rank.set(id, best);
    return best;
  };

  for (const n of model.nodes) visit(n.id);

  // Longest-path from successors ranks sinks highest; invert so sources lead.
  const max = Math.max(0, ...rank.values());
  const flipped = new Map<string, number>();
  for (const [id, value] of rank) flipped.set(id, max - value);
  return flipped;
}

export function layoutFlowchart(model: FlowModel): FlowLayout {
  if (model.nodes.length === 0) return { width: 0, height: 0, nodes: [], edges: [] };

  const vertical = model.direction === 'TB' || model.direction === 'BT';
  const reversed = model.direction === 'RL' || model.direction === 'BT';
  const rankOf = ranks(model);

  const items = model.nodes.map(node => ({ node, ...measure(node), rank: rankOf.get(node.id) ?? 0 }));
  const rankCount = Math.max(...items.map(i => i.rank)) + 1;
  const buckets: typeof items[] = Array.from({ length: rankCount }, () => []);
  for (const item of items) buckets[item.rank].push(item);

  const placed = new Map<string, PlacedNode>();
  const positions: PlacedNode[] = [];
  const mainSizes = buckets.map(b => Math.max(...b.map(i => (vertical ? i.w : i.h))));

  const mainStarts: number[] = [];
  let cursor = MARGIN;
  for (let r = 0; r < rankCount; r++) {
    mainStarts[r] = cursor;
    cursor += mainSizes[r] + RANK_GAP;
  }
  const mainTotal = cursor - RANK_GAP + MARGIN;

  // Cross-axis: stack siblings centred on the longest lane.
  const lanes = buckets.map(b => b.reduce((sum, i) => sum + (vertical ? i.w : i.h), 0) + SIBLING_GAP * (b.length - 1));
  const laneMax = Math.max(...lanes);
  const crossStarts = lanes.map(len => MARGIN + (laneMax - len) / 2);
  const crossTotal = laneMax + MARGIN * 2;

  for (let r = 0; r < rankCount; r++) {
    const rank = reversed ? rankCount - 1 - r : r;
    let along = crossStarts[r];
    for (const item of buckets[r]) {
      const main = mainStarts[rank] + (mainSizes[rank] - (vertical ? item.w : item.h)) / 2;
      const cross = along;
      const placedNode: PlacedNode = vertical
        ? { ...item.node, x: cross, y: main, w: item.w, h: item.h }
        : { ...item.node, x: main, y: cross, w: item.w, h: item.h };
      placed.set(item.node.id, placedNode);
      positions.push(placedNode);
      along += (vertical ? item.w : item.h) + SIBLING_GAP;
    }
  }

  const nodes = model.nodes.map(n => placed.get(n.id)).filter((n): n is PlacedNode => Boolean(n));

  const edges: RoutedEdge[] = [];
  for (const edge of model.edges) {
    const a = placed.get(edge.from);
    const b = placed.get(edge.to);
    if (!a || !b) continue;

    const aCx = a.x + a.w / 2;
    const aCy = a.y + a.h / 2;
    const bCx = b.x + b.w / 2;
    const bCy = b.y + b.h / 2;
    const dx = bCx - aCx;
    const dy = bCy - aCy;
    const angle = Math.atan2(dy, dx);

    // Clip the segment to both node boxes so arrowheads touch the border.
    const startX = aCx + Math.cos(angle) * (a.w / 2) * 0.96;
    const startY = aCy + Math.sin(angle) * (a.h / 2) * 0.96;
    const endX = bCx - Math.cos(angle) * (b.w / 2) * 0.96;
    const endY = bCy - Math.sin(angle) * (b.h / 2) * 0.96;

    const bend = Math.abs(dy) > Math.abs(dx)
      ? `M${startX},${startY} C${startX},${(startY + endY) / 2} ${endX},${(startY + endY) / 2} ${endX},${endY}`
      : `M${startX},${startY} C${(startX + endX) / 2},${startY} ${(startX + endX) / 2},${endY} ${endX},${endY}`;

    edges.push({
      d: bend,
      label: edge.label,
      labelX: (startX + endX) / 2,
      labelY: (startY + endY) / 2,
      dashed: edge.dashed,
      thick: edge.thick,
      arrow: edge.arrow,
      x: endX,
      y: endY,
      angle,
    });
  }

  const width = vertical ? crossTotal : mainTotal;
  const height = vertical ? mainTotal : crossTotal;
  return { width, height, nodes, edges };
}
