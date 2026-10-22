/**
 * RelationEdge.tsx
 * Custom ReactFlow edge for DB relations.
 *
 * Cardinality is encoded only by the line ends (crow's-foot notation):
 *   one  = perpendicular bar
 *   many = fan of three strokes
 *
 * When a field of this relation is hovered the line animates a flow from
 * `relation.from` to `relation.to`; unrelated edges dim.
 */

import { memo } from 'react';
import { BaseEdge, getSmoothStepPath, useStore, type EdgeProps } from '@xyflow/react';
import type { RelationEdgeData } from '../../engine/layout';
import type { RelationCardinality } from '../../types/schema';
import { useActiveEdges } from './fieldHover';

// ─── Cardinality ends ─────────────────────────────────────────────────────────

type EndKind = 'one' | 'many';

const CARD_ENDS: Record<RelationCardinality, { start: EndKind; end: EndKind }> = {
  '1:1': { start: 'one', end: 'one' },
  '1:N': { start: 'one', end: 'many' },
  'N:1': { start: 'many', end: 'one' },
  'N:M': { start: 'many', end: 'many' },
};

const MARKER_ONE = 'xdiag-card-one';
const MARKER_MANY = 'xdiag-card-many';

/** Marker size on screen, independent of canvas zoom (like edge labels). */
const MARKER_PX = 12;

/**
 * Marker definitions, rendered once per canvas. `markerUnits="userSpaceOnUse"`
 * sizes markers in flow coordinates, which would shrink them to a dot at fit
 * zoom — so the width is divided by the current zoom to keep a constant
 * on-screen size.
 */
export function CardinalityMarkers() {
  const zoom = useStore(s => s.transform[2]);
  const size = MARKER_PX / zoom;

  return (
    <svg
      aria-hidden
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <marker
          id={MARKER_ONE}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth={size}
          markerHeight={size}
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <line x1="6.5" y1="1" x2="6.5" y2="9" stroke="var(--xd-accent-soft)" strokeWidth="1.8" />
        </marker>
        <marker
          id={MARKER_MANY}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={size}
          markerHeight={size}
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path
            d="M9 0.5 L1.5 5 L9 9.5 M1.5 5 L9 5"
            stroke="var(--xd-accent-soft)"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
    </svg>
  );
}

// ─── RelationEdge ─────────────────────────────────────────────────────────────

function RelationEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
  selected,
}: EdgeProps) {
  const { relation } = data as unknown as RelationEdgeData;
  const ends = CARD_ENDS[relation.cardinality ?? '1:N'];

  const activeEdges = useActiveEdges();
  const isActive = activeEdges?.has(id) ?? false;
  const isDimmed = activeEdges !== null && !isActive;

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 6,
  });

  const stroke = isActive
    ? 'var(--xd-edge-active)'
    : selected
      ? 'var(--xd-accent-soft)'
      : 'color-mix(in srgb, var(--xd-edge) 50%, transparent)';
  const width = isActive ? 2.5 : selected ? 2 : 1.5;

  return (
    <>
      {isActive && (
        <path
          d={edgePath}
          fill="none"
          stroke="var(--xd-edge-active)"
          strokeLinecap="round"
          className="xdiag-flow"
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: width,
          transition: 'stroke 0.15s, stroke-width 0.15s, opacity 0.15s',
          opacity: isDimmed ? 0.3 : 1,
        }}
        markerStart={`url(#${ends.start === 'one' ? MARKER_ONE : MARKER_MANY})`}
        markerEnd={`url(#${ends.end === 'one' ? MARKER_ONE : MARKER_MANY})`}
      />
    </>
  );
}

export default memo(RelationEdge);
