import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { computeLayout, handleId, routeEdges } from './layout';
import type { RelationEdgeData } from './layout';
import type { Relation, Schema } from '../types/schema';

function table(id: string, fieldCount = 2) {
  return {
    id,
    name: id,
    fields: Array.from({ length: fieldCount }, (_, i) => ({
      id: `${id}.f${i}`,
      name: `f${i}`,
      type: 'int',
      primaryKey: i === 0,
      unique: false,
      notNull: false,
      increment: false,
    })),
  };
}

const relation: Relation = {
  id: 'rel_1',
  cardinality: '1:N',
  from: { tableId: 'a', fieldId: 'a.f0', fieldName: 'f0' },
  to: { tableId: 'b', fieldId: 'b.f0', fieldName: 'f0' },
};

const schema: Schema = {
  tables: [table('a'), table('b', 3)],
  relations: [relation],
  enums: [],
  tableGroups: [{ id: 'g', name: 'g', tableIds: ['a', 'b'] }],
};

function tableNode(id: string, x: number, width = 240): Node {
  return { id, type: 'tableNode', position: { x, y: 0 }, data: {}, width };
}

function edge(source: string, target: string): Edge {
  return {
    id: 'rel_1',
    source,
    target,
    data: { relation } as RelationEdgeData,
  };
}

describe('computeLayout', () => {
  it('emits one node per table plus one per non-empty group', () => {
    const { nodes, edges } = computeLayout(schema);
    expect(nodes.map(n => n.id).sort()).toEqual(['a', 'b', 'g']);
    expect(nodes.filter(n => n.type === 'tableNode')).toHaveLength(2);
    expect(edges).toHaveLength(1);
  });

  it('sizes table nodes from their field count', () => {
    const { nodes } = computeLayout(schema);
    const a = nodes.find(n => n.id === 'a')!;
    const b = nodes.find(n => n.id === 'b')!;
    expect(a.width).toBe(240);
    expect(a.height).toBe(38 + 2 * 28 + 8);
    expect(b.height).toBe(38 + 3 * 28 + 8);
  });

  it('keeps raw field ids as handles until routing runs', () => {
    const { edges } = computeLayout(schema);
    expect(edges[0]).toMatchObject({
      sourceHandle: 'a.f0',
      targetHandle: 'b.f0',
      type: 'relationEdge',
    });
  });

  it('renders groups behind tables and edges above both', () => {
    const { nodes, edges } = computeLayout(schema);
    expect(nodes.find(n => n.id === 'g')!.zIndex).toBe(-1);
    expect(nodes.find(n => n.id === 'a')!.zIndex).toBe(1);
    expect(edges[0].zIndex).toBe(2);
  });

  it('survives relations that point at unknown tables', () => {
    const orphan: Schema = {
      ...schema,
      relations: [{ ...relation, to: { tableId: 'nope', fieldId: 'nope.f0', fieldName: 'f0' } }],
    };
    expect(() => computeLayout(orphan)).not.toThrow();
  });

  it('orients the graph by direction', () => {
    const lr = computeLayout(schema, 'LR');
    const tb = computeLayout(schema, 'TB');
    const dx = (nodes: Node[]) => {
      const a = nodes.find(n => n.id === 'a')!;
      const b = nodes.find(n => n.id === 'b')!;
      return Math.abs(a.position.x - b.position.x) > Math.abs(a.position.y - b.position.y);
    };
    expect(dx(lr.nodes)).toBe(true);
    expect(dx(tb.nodes)).toBe(false);
  });
});

describe('handleId', () => {
  it('encodes field, side and role', () => {
    expect(handleId('users.id', 'left', 'target')).toBe('users.id__left-target');
    expect(handleId('users.id', 'right', 'source')).toBe('users.id__right-source');
  });
});

describe('routeEdges', () => {
  it('routes source→right / target→left when the target sits to the right', () => {
    const [routed] = routeEdges([edge('a', 'b')], [tableNode('a', 0), tableNode('b', 600)]);
    expect(routed.sourceHandle).toBe('a.f0__right-source');
    expect(routed.targetHandle).toBe('b.f0__left-target');
  });

  it('flips both ends when the target is dragged to the left', () => {
    const [routed] = routeEdges([edge('a', 'b')], [tableNode('a', 600), tableNode('b', 0)]);
    expect(routed.sourceHandle).toBe('a.f0__left-source');
    expect(routed.targetHandle).toBe('b.f0__right-target');
  });

  it('is idempotent', () => {
    const nodes = [tableNode('a', 600), tableNode('b', 0)];
    const once = routeEdges([edge('a', 'b')], nodes);
    const twice = routeEdges(once, nodes);
    expect(twice).toEqual(once);
  });

  it('uses measured width when the node has no width', () => {
    const measured: Node = {
      id: 'b',
      type: 'tableNode',
      position: { x: 500, y: 0 },
      data: {},
      measured: { width: 400, height: 10 },
    };
    // a occupies 0..240 (centre 120), b occupies 500..900 (centre 700): b is right.
    const [routed] = routeEdges([edge('a', 'b')], [tableNode('a', 0), measured]);
    expect(routed.sourceHandle).toBe('a.f0__right-source');
  });

  it('leaves edges untouched when an endpoint is missing or untyped', () => {
    const original = edge('a', 'b');
    const noData: Edge = { id: 'rel_1', source: 'a', target: 'b' };
    const nodes = [tableNode('a', 0), tableNode('b', 600)];
    expect(routeEdges([original], [tableNode('a', 0)])[0]).toEqual(original);
    expect(routeEdges([noData], nodes)[0]).toEqual(noData);
    const groupNode: Node = { id: 'b', type: 'groupNode', position: { x: 600, y: 0 }, data: {} };
    expect(routeEdges([original], [tableNode('a', 0), groupNode])[0]).toEqual(original);
  });
});
