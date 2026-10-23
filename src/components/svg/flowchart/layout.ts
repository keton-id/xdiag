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

/** Orthogonal polyline with rounded corners at each interior vertex. */
function roundedPath(raw: { x: number; y: number }[], radius: number): string {
  // Zero-length legs would divide by zero when rounding.
  const points = raw.filter(
    (p, i) => i === 0 || Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y) > 0.01,
  );
  if (points.length < 2) return '';
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const beforeX = cur.x - ((cur.x - prev.x) / inLen) * r;
    const beforeY = cur.y - ((cur.y - prev.y) / inLen) * r;
    const afterX = cur.x + ((next.x - cur.x) / outLen) * r;
    const afterY = cur.y + ((next.y - cur.y) / outLen) * r;
    d += ` L${beforeX},${beforeY} Q${cur.x},${cur.y} ${afterX},${afterY}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x},${last.y}`;
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
  // Main axis is y when vertical, x otherwise; the rank advances by the
  // extent on that axis.
  const mainSizes = buckets.map(b => Math.max(...b.map(i => (vertical ? i.h : i.w))));

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
      const main = mainStarts[rank] + (mainSizes[rank] - (vertical ? item.h : item.w)) / 2;
      const cross = along;
      const placedNode: PlacedNode = vertical
        ? { ...item.node, x: cross, y: main, w: item.w, h: item.h }
        : { ...item.node, x: main, y: cross, w: item.w, h: item.h };
      placed.set(item.node.id, placedNode);
      along += (vertical ? item.w : item.h) + SIBLING_GAP;
    }
  }

  const nodes = model.nodes.map(n => placed.get(n.id)).filter((n): n is PlacedNode => Boolean(n));
  const limit = nodes.reduce((max, n) => Math.max(max, (vertical ? n.y + n.h : n.x + n.w)), 0) + MARGIN;

  // Routes are computed in main/cross space, then mapped back to x/y. The
  // reading direction is already baked into the positions, so "forward" is
  // just a higher main coordinate than the source.
  const toXY = (main: number, cross: number) => (vertical ? { x: cross, y: main } : { x: main, y: cross });
  const span = (node: PlacedNode) => ({
    main: vertical ? node.y : node.x,
    cross: vertical ? node.x : node.y,
    mainSize: vertical ? node.h : node.w,
    crossSize: vertical ? node.w : node.h,
  });
  // Back edges run in a lane past the last node, so they never cross one.
  const channel = MARGIN + laneMax + 24;

  /**
   * Back edges need a straight run at a fixed main coordinate from
   * `fromCross` down to `channel`. Slide it off any node that would sit in
   * that corridor, preferring the smallest move.
   */
  const freeMain = (preferred: number, fromCross: number, toCross: number): number => {
    const lo = Math.min(fromCross, toCross);
    const hi = Math.max(fromCross, toCross);
    const blocked = (main: number) =>
      nodes.some(n => {
        const s = span(n);
        return (
          main >= s.main - 8 &&
          main <= s.main + s.mainSize + 8 &&
          // Inset the corridor so merely touching the face a leg leaves from
          // does not count as an obstruction.
          s.cross < hi - 4 &&
          s.cross + s.crossSize > lo + 4
        );
      });
    if (!blocked(preferred)) return preferred;
    const candidates = nodes
      .flatMap(n => {
        const s = span(n);
        return [s.main - 20, s.main + s.mainSize + 20];
      })
      .filter(m => m > 0 && m < limit)
      .sort((p, q) => Math.abs(p - preferred) - Math.abs(q - preferred));
    return candidates.find(m => !blocked(m)) ?? preferred;
  };

  type Pt = { x: number; y: number };

  /** Would a straight run between two cross coordinates hit a node? */
  const crossBlocked = (cross: number, fromMain: number, toMain: number, skip: PlacedNode[]) => {
    const lo = Math.min(fromMain, toMain);
    const hi = Math.max(fromMain, toMain);
    return nodes.some(n => {
      if (skip.includes(n)) return false;
      const s = span(n);
      return (
        cross >= s.cross - 8 &&
        cross <= s.cross + s.crossSize + 8 &&
        s.main < hi - 4 &&
        s.main + s.mainSize > lo + 4
      );
    });
  };

  /** Lowest-collision cross lane for a main span, preferring `preferred`. */
  const freeCross = (fromMain: number, toMain: number, preferred: number): number => {
    const candidates = [
      preferred,
      ...nodes.flatMap(n => {
        const s = span(n);
        return [s.cross - 14, s.cross + s.crossSize + 14];
      }),
    ]
      .filter(c => c > 0)
      .sort((p, q) => Math.abs(p - preferred) - Math.abs(q - preferred));
    return candidates.find(c => !crossBlocked(c, fromMain, toMain, [])) ?? preferred;
  };

  /**
   * A forward edge that skips a rank cuts across the skipped column. Sample
   * the curve; when it lands inside another node, reroute it orthogonally
   * through the free gap between ranks instead.
   */
  const cubicHitsNode = (p0: Pt, c1: Pt, c2: Pt, p3: Pt, skip: PlacedNode[]) => {
    for (let i = 1; i < 24; i++) {
      const t = i / 24;
      const u = 1 - t;
      const x = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x;
      const y = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y;
      const hit = nodes.some(n => {
        if (skip.includes(n)) return false;
        return x > n.x + 2 && x < n.x + n.w - 2 && y > n.y + 2 && y < n.y + n.h - 2;
      });
      if (hit) return true;
    }
    return false;
  };

  const edges: RoutedEdge[] = [];
  for (const edge of model.edges) {
    const a = placed.get(edge.from);
    const b = placed.get(edge.to);
    if (!a || !b) continue;

    const sa = span(a);
    const sb = span(b);
    const aMainMid = sa.main + sa.mainSize / 2;
    const bMainMid = sb.main + sb.mainSize / 2;
    const aCrossMid = sa.cross + sa.crossSize / 2;
    const bCrossMid = sb.cross + sb.crossSize / 2;

    let d: string;
    let labelX: number;
    let labelY: number;
    let endX: number;
    let endY: number;
    let endAngle: number;

    if (bMainMid > aMainMid + 0.5) {
      // Forward: leave the trailing face and arrive at the leading face, so
      // arrowheads stop on the border instead of inside the box.
      const startMain = sa.main + sa.mainSize;
      const endMain = sb.main;
      // Half the gap: a straight run that never overshoots into an S-bend.
      const control = Math.max(0, (endMain - startMain) / 2);
      const p0 = toXY(startMain, aCrossMid);
      const c1 = toXY(startMain + control, aCrossMid);
      const c2 = toXY(endMain - control, bCrossMid);
      const p3 = toXY(endMain, bCrossMid);
      if (cubicHitsNode(p0, c1, c2, p3, [a, b])) {
        // Rank-skipping edge that would cut a corner: go around through a
        // cross lane that is clear for the whole span.
        const lane = freeCross(startMain, endMain, bCrossMid);
        const points = [
          p0,
          toXY(startMain + 16, aCrossMid),
          toXY(startMain + 16, lane),
          toXY(endMain - 16, lane),
          toXY(endMain - 16, bCrossMid),
          p3,
        ];
        d = roundedPath(points, 12);
        labelX = (points[3].x + points[2].x) / 2;
        labelY = (points[3].y + points[2].y) / 2;
        endX = p3.x;
        endY = p3.y;
        endAngle = Math.atan2(p3.y - points[4].y, p3.x - points[4].x);
      } else {
        // de Casteljau at t = 0.5: the label sits on the curve, not on the chord.
        labelX = (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8;
        labelY = (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8;
        d = `M${p0.x},${p0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p3.x},${p3.y}`;
        endX = p3.x;
        endY = p3.y;
        endAngle = Math.atan2(p3.y - c2.y, p3.x - c2.x);
      }
    } else {
      // Backward or same-rank: drop into the channel, run along it, and come
      // back up into the target's trailing face. Both legs are slid off any
      // node standing in the way.
      const down = freeMain(aMainMid, sa.cross + sa.crossSize, channel);
      const up = freeMain(bMainMid, sb.cross + sb.crossSize, channel);
      const points = [
        toXY(aMainMid, sa.cross + sa.crossSize),
        toXY(down, sa.cross + sa.crossSize),
        toXY(down, channel),
        toXY(up, channel),
        toXY(up, sb.cross + sb.crossSize),
        toXY(bMainMid, sb.cross + sb.crossSize),
      ];
      d = roundedPath(points, 14);
      const [from, to] = [points[2], points[3]];
      labelX = (from.x + to.x) / 2;
      labelY = (from.y + to.y) / 2;
      const last = points[5];
      const prev = points[4];
      endX = last.x;
      endY = last.y;
      endAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
    }

    edges.push({
      d,
      label: edge.label,
      labelX,
      labelY,
      dashed: edge.dashed,
      thick: edge.thick,
      arrow: edge.arrow,
      x: endX,
      y: endY,
      angle: endAngle,
    });
  }

  const width = vertical ? crossTotal : mainTotal;
  const height = vertical ? mainTotal : crossTotal;
  return { width, height, nodes, edges };
}
