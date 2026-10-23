/**
 * layout.test.ts
 * Geometry invariants for the flowchart layout: edges must route around node
 * boxes rather than through them, in every reading direction.
 */

import { describe, expect, it } from 'vitest';

import { layoutFlowchart } from './layout';
import { parseFlowchart } from '../../../kinds/flowchart/parse';
import { SAMPLE_FLOWCHART } from '../../../kinds/samples';

type Point = [number, number];

/** Sample every segment of a path the layout emits (`M`, `L`, `Q`, `C`). */
function samplePath(d: string, steps = 32): Point[] {
  const points: Point[] = [];
  let cur: Point = [0, 0];
  for (const token of d.match(/[MLQC][^MLQC]*/g) ?? []) {
    const nums = (token.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (token[0] === 'M' || token[0] === 'L') {
      cur = [nums[0], nums[1]];
      points.push(cur);
    } else if (token[0] === 'Q') {
      const c: Point = [nums[0], nums[1]];
      const end: Point = [nums[2], nums[3]];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        points.push([
          u * u * cur[0] + 2 * u * t * c[0] + t * t * end[0],
          u * u * cur[1] + 2 * u * t * c[1] + t * t * end[1],
        ]);
      }
      cur = end;
    } else {
      const c1: Point = [nums[0], nums[1]];
      const c2: Point = [nums[2], nums[3]];
      const end: Point = [nums[4], nums[5]];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        points.push([
          u * u * u * cur[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0],
          u * u * u * cur[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1],
        ]);
      }
      cur = end;
    }
  }
  return points;
}

const DIRECTIONS = ['LR', 'TB', 'RL', 'BT'] as const;

describe('layoutFlowchart', () => {
  it.each(DIRECTIONS)('routes %s edges clear of every node box', direction => {
    const source = SAMPLE_FLOWCHART.replace('flowchart LR', `flowchart ${direction}`);
    const layout = layoutFlowchart(parseFlowchart(source));
    expect(layout.edges).toHaveLength(6);

    const intrusions: string[] = [];
    for (const edge of layout.edges) {
      for (const [x, y] of samplePath(edge.d)) {
        for (const node of layout.nodes) {
          const inside =
            x > node.x + 3 &&
            x < node.x + node.w - 3 &&
            y > node.y + 3 &&
            y < node.y + node.h - 3;
          if (inside) intrusions.push(`${node.id} at ${Math.round(x)},${Math.round(y)}`);
        }
      }
    }
    expect(intrusions).toEqual([]);
  });

  it('keeps RANK_GAP of clear space between adjacent ranks', () => {
    const layout = layoutFlowchart(parseFlowchart(SAMPLE_FLOWCHART));
    const byId = new Map(layout.nodes.map(n => [n.id, n]));
    const parse = byId.get('parse')!;
    const layoutNode = byId.get('layout')!;
    expect(layoutNode.x - (parse.x + parse.w)).toBeGreaterThanOrEqual(40);
  });
});
