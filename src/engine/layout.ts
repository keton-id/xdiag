/**
 * layout.ts
 * Dagre-based auto-layout for ERD diagrams.
 * Produces ReactFlow nodes (tableNode, groupNode) and edges (relationEdge).
 */

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { Schema, Table, Relation, TableGroup } from '../types/schema';

export type LayoutDirection = 'LR' | 'TB';

// ─── Dimensions ───────────────────────────────────────────────────────────────

const NODE_WIDTH = 240;
const FIELD_HEIGHT = 28;
const HEADER_HEIGHT = 38;
const NODE_V_PAD = 8;
const GROUP_PADDING = 32;

function tableNodeHeight(table: Table): number {
  return HEADER_HEIGHT + table.fields.length * FIELD_HEIGHT + NODE_V_PAD;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TableNodeData {
  table: Table;
  schema: Schema;
  [key: string]: unknown;
}

export interface GroupNodeData {
  group: TableGroup;
  [key: string]: unknown;
}

export interface RelationEdgeData {
  relation: Relation;
  [key: string]: unknown;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function computeLayout(schema: Schema, direction: LayoutDirection = 'LR'): LayoutResult {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });

  // Register table nodes
  for (const table of schema.tables) {
    const h = tableNodeHeight(table);
    g.setNode(table.id, { width: NODE_WIDTH, height: h });
  }

  // Register group nodes as compound parents
  for (const group of schema.tableGroups) {
    g.setNode(group.id, { width: 0, height: 0 });
    for (const tid of group.tableIds) {
      if (g.hasNode(tid)) {
        g.setParent(tid, group.id);
      }
    }
  }

  // Register edges (for layout purposes only)
  for (const rel of schema.relations) {
    if (g.hasNode(rel.from.tableId) && g.hasNode(rel.to.tableId)) {
      g.setEdge(rel.from.tableId, rel.to.tableId, { id: rel.id });
    }
  }

  dagre.layout(g);

  // ── Build ReactFlow nodes ──────────────────────────────────────────────────

  const rfNodes: Node[] = [];

  // Group boundary nodes first (rendered beneath tables)
  for (const group of schema.tableGroups) {
    const memberIds = group.tableIds.filter(tid => g.hasNode(tid));
    if (memberIds.length === 0) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const tid of memberIds) {
      const n = g.node(tid);
      const hw = NODE_WIDTH / 2;
      const hh = tableNodeHeight(schema.tables.find(t => t.id === tid)!) / 2;
      minX = Math.min(minX, n.x - hw);
      minY = Math.min(minY, n.y - hh);
      maxX = Math.max(maxX, n.x + hw);
      maxY = Math.max(maxY, n.y + hh);
    }

    rfNodes.push({
      id: group.id,
      type: 'groupNode',
      position: { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING - 24 },
      style: {
        width: maxX - minX + GROUP_PADDING * 2,
        height: maxY - minY + GROUP_PADDING * 2 + 24,
        pointerEvents: 'none' as const,
      },
      data: { group } as GroupNodeData,
      selectable: false,
      draggable: false,
      zIndex: -1,
    });
  }

  // Table nodes
  for (const table of schema.tables) {
    const n = g.node(table.id);
    if (!n) continue;
    const h = tableNodeHeight(table);
    rfNodes.push({
      id: table.id,
      type: 'tableNode',
      position: { x: n.x - NODE_WIDTH / 2, y: n.y - h / 2 },
      data: { table, schema } as TableNodeData,
      width: NODE_WIDTH,
      height: h,
      zIndex: 1,
    });
  }

  // ── Build ReactFlow edges ──────────────────────────────────────────────────

  // Handles are resolved per side by `routeEdges`, which needs live node
  // positions (the user can drag tables anywhere).
  const rfEdges: Edge[] = schema.relations.map(rel => ({
    id: rel.id,
    source: rel.from.tableId,
    target: rel.to.tableId,
    sourceHandle: rel.from.fieldId,
    targetHandle: rel.to.fieldId,
    type: 'relationEdge',
    data: { relation: rel } as RelationEdgeData,
    zIndex: 2,
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ─── Relation side routing ────────────────────────────────────────────────────

export type HandleSide = 'left' | 'right';

/** Handle id rendered by TableNode: `<fieldId>__<side>-<source|target>`. */
export function handleId(fieldId: string, side: HandleSide, type: 'source' | 'target'): string {
  return `${fieldId}__${side}-${type}`;
}

/**
 * Points each relation at the nearest side of both tables. Recomputed on every
 * drag so moving a table flips its endpoints to face the other end.
 */
export function routeEdges(edges: Edge[], nodes: Node[]): Edge[] {
  const boxes = new Map<string, { x: number; y: number; w: number }>();
  for (const node of nodes) {
    if (node.type !== 'tableNode') continue;
    boxes.set(node.id, {
      x: node.position.x,
      y: node.position.y,
      w: node.width ?? node.measured?.width ?? NODE_WIDTH,
    });
  }

  return edges.map(edge => {
    const from = boxes.get(edge.source);
    const to = boxes.get(edge.target);
    const relation = (edge.data as RelationEdgeData | undefined)?.relation;
    if (!from || !to || !relation) return edge;

    const targetIsRight = to.x + to.w / 2 >= from.x + from.w / 2;
    return {
      ...edge,
      sourceHandle: handleId(relation.from.fieldId, targetIsRight ? 'right' : 'left', 'source'),
      targetHandle: handleId(relation.to.fieldId, targetIsRight ? 'left' : 'right', 'target'),
    };
  });
}
