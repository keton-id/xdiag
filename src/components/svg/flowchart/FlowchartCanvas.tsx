/**
 * FlowchartCanvas.tsx
 * Hand-rolled SVG flowchart renderer over `layout.ts`.
 */

import { useEffect, useMemo } from 'react';

import type { FlowModel } from '../../../kinds/types';
import type { FitRegistrar } from '../fit';
import { usePanZoom } from '../usePanZoom';
import ZoomPanel from '../ZoomPanel';
import { layoutFlowchart, type PlacedNode, type RoutedEdge } from './layout';

const FONT = 'ui-sans-serif, system-ui, sans-serif';

function NodeShape({ node }: { node: PlacedNode }) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const stroke = 'var(--xd-edge)';
  const fill = 'var(--xd-surface-alt)';

  const label = (
    <text
      x={cx}
      y={cy + 4.5}
      textAnchor="middle"
      fontSize={12.5}
      fill="var(--xd-fg)"
      fontFamily={FONT}
      fontWeight={500}
    >
      {node.label}
    </text>
  );

  if (node.shape === 'diamond') {
    return (
      <g>
        <path
          d={`M${cx},${node.y} L${node.x + node.w},${cy} L${cx},${node.y + node.h} L${node.x},${cy} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.4}
        />
        {label}
      </g>
    );
  }

  if (node.shape === 'circle') {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={node.w / 2} ry={node.h / 2} fill={fill} stroke={stroke} strokeWidth={1.4} />
        {label}
      </g>
    );
  }

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={node.shape === 'round' ? node.h / 2 : 6}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.4}
      />
      {label}
    </g>
  );
}

function Edge({ edge }: { edge: RoutedEdge }) {
  const head = edge.arrow ? (edge.thick ? 11 : 9) : 0;
  const ang = edge.angle;
  const ax = edge.x;
  const ay = edge.y;
  const p1x = ax - Math.cos(ang - 0.42) * head;
  const p1y = ay - Math.sin(ang - 0.42) * head;
  const p2x = ax - Math.cos(ang + 0.42) * head;
  const p2y = ay - Math.sin(ang + 0.42) * head;

  return (
    <g>
      <path
        d={edge.d}
        fill="none"
        stroke="var(--xd-edge-active)"
        strokeWidth={edge.thick ? 2.4 : 1.5}
        strokeDasharray={edge.dashed ? '6 4' : undefined}
        markerEnd={undefined}
      />
      {edge.arrow && <path d={`M${ax},${ay} L${p1x},${p1y} L${p2x},${p2y} Z`} fill="var(--xd-edge-active)" />}
      {edge.label && (
        <g>
          <rect
            x={edge.labelX - edge.label.length * 3.4 - 5}
            y={edge.labelY - 9}
            width={edge.label.length * 6.8 + 10}
            height={18}
            rx={4}
            fill="var(--xd-bg)"
          />
          <text x={edge.labelX} y={edge.labelY + 4} textAnchor="middle" fontSize={11} fill="var(--xd-muted)" fontFamily={FONT}>
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

export default function FlowchartCanvas({
  model,
  onFitView,
}: {
  model: FlowModel;
  onFitView?: FitRegistrar;
}) {
  const layout = useMemo(() => layoutFlowchart(model), [model]);
  const panZoom = usePanZoom();
  const { fit } = panZoom;

  useEffect(() => {
    if (layout.width > 0) fit(layout.width, layout.height);
  }, [layout.width, layout.height, fit]);

  useEffect(() => {
    if (!onFitView) return;
    onFitView(() => fit(layout.width, layout.height));
  }, [onFitView, fit, layout.width, layout.height]);

  if (layout.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Add nodes to see the flowchart.
      </div>
    );
  }

  return (
    <div
      ref={panZoom.hostRef}
      data-testid="flowchart-canvas"
      className="relative h-full w-full overflow-hidden"
      style={{ background: 'var(--xd-bg)', cursor: panZoom.dragging ? 'grabbing' : 'grab' }}
      onPointerDown={panZoom.onPointerDown}
      onPointerMove={panZoom.onPointerMove}
      onPointerUp={panZoom.onPointerUp}
      onPointerCancel={panZoom.onPointerUp}
    >
      <svg
        width="100%"
        height="100%"
        data-canvas-svg
        data-svg-width={layout.width}
        data-svg-height={layout.height}
      >
        <g transform={`translate(${panZoom.view.x},${panZoom.view.y}) scale(${panZoom.view.k})`}>
          <rect
            width={layout.width}
            height={layout.height}
            fill="var(--xd-bg)"
          />
          {layout.edges.map((edge, i) => (
            <Edge key={i} edge={edge} />
          ))}
          {layout.nodes.map(node => (
            <NodeShape key={node.id} node={node} />
          ))}
        </g>
      </svg>
      <ZoomPanel panZoom={panZoom} />
    </div>
  );
}
