/**
 * ERDCanvas.tsx
 * ReactFlow canvas wiring custom nodes/edges with Background, MiniMap and the
 * custom zoom navigation panel.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TableNode from './TableNode';
import GroupNode from './GroupNode';
import RelationEdge, { CardinalityMarkers } from './RelationEdge';
import ZoomControls from './ZoomControls';
import { computeLayout, routeEdges, type LayoutDirection } from '../../engine/layout';
import type { Schema } from '../../types/schema';
import type { Settings } from '../../theme';
import {
  HoveredFieldContext,
  SetHoveredFieldContext,
  ActiveEdgesContext,
} from './fieldHover';

// ─── Node / Edge type registries ─────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
  groupNode: GroupNode,
};

const edgeTypes: EdgeTypes = {
  relationEdge: RelationEdge,
};

// ─── Inner canvas ─────────────────────────────────────────────────────────────

interface InnerCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  showGrid: boolean;
  showMinimap: boolean;
}

function InnerCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  showGrid,
  showMinimap,
}: InnerCanvasProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--xd-bg)' }}
      minZoom={0.1}
      maxZoom={2}
    >
      <CardinalityMarkers />
      {showGrid && (
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--xd-grid)" />
      )}
      <ZoomControls />
      {showMinimap && (
        <MiniMap
          nodeColor={n => (n.type === 'groupNode' ? 'var(--xd-surface-alt)' : 'var(--xd-accent)')}
          maskColor="color-mix(in srgb, var(--xd-bg) 75%, transparent)"
          className="!border !border-[var(--xd-border)] !bg-[var(--xd-surface)]"
        />
      )}
    </ReactFlow>
  );
}

// ─── ERDCanvas ────────────────────────────────────────────────────────────────

interface ERDCanvasProps {
  schema: Schema;
  direction: LayoutDirection;
  layoutKey: number; // increment to re-run layout
  settings: Settings;
  onFitView: ((fn: () => void) => void);
}

export default function ERDCanvas({
  schema,
  direction,
  layoutKey,
  settings,
  onFitView,
}: ERDCanvasProps) {
  const initial = useMemo(() => computeLayout(schema, direction), [schema, direction]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  // Endpoints follow the live node positions, so dragging a table past its
  // partner flips the relation to the facing side.
  const routedEdges = useMemo(() => routeEdges(edges, nodes), [edges, nodes]);

  // A schema edit can unmount the hovered row without a mouseleave, leaving
  // every edge dimmed. Reset during render so no stale frame is painted.
  const [prevSchema, setPrevSchema] = useState(schema);
  if (prevSchema !== schema) {
    setPrevSchema(schema);
    setHoveredFieldId(null);
  }

  // Relations touching the hovered field; null when nothing is hovered.
  const activeEdges = useMemo(() => {
    if (!hoveredFieldId) return null;
    return new Set(
      schema.relations
        .filter(
          rel =>
            rel.from.fieldId === hoveredFieldId ||
            rel.to.fieldId === hoveredFieldId,
        )
        .map(rel => rel.id),
    );
  }, [hoveredFieldId, schema.relations]);

  // Expose fitView to parent toolbar via callback ref pattern
  const { fitView } = useReactFlow();
  const doFit = useCallback(() => fitView({ padding: 0.15, duration: 400 }), [fitView]);
  useEffect(() => { onFitView(doFit); }, [doFit, onFitView]);

  // Synchronize layout when schema, direction, or manual layoutKey changes
  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = computeLayout(schema, direction);
    setNodes(nextNodes);
    setEdges(nextEdges);

    const timer = setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 });
    }, 60);
    return () => clearTimeout(timer);
  }, [schema, direction, layoutKey, setNodes, setEdges, fitView]);

  return (
    <SetHoveredFieldContext.Provider value={setHoveredFieldId}>
      <HoveredFieldContext.Provider value={hoveredFieldId}>
        <ActiveEdgesContext.Provider value={activeEdges}>
          <InnerCanvas
            nodes={nodes}
            edges={routedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            showGrid={settings.showGrid}
            showMinimap={settings.showMinimap}
          />
        </ActiveEdgesContext.Provider>
      </HoveredFieldContext.Provider>
    </SetHoveredFieldContext.Provider>
  );
}
