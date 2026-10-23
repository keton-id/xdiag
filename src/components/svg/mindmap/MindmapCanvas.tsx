/**
 * MindmapCanvas.tsx
 * Hand-rolled SVG mindmap renderer: curved branches, depth-tinted nodes.
 */

import { useEffect, useMemo } from 'react';

import type { MindModel } from '../../../kinds/types';
import type { FitRegistrar } from '../fit';
import { usePanZoom } from '../usePanZoom';
import ZoomPanel from '../ZoomPanel';
import { layoutMindmap, type PlacedMind } from './layout';

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const BRANCH = ['var(--xd-accent)', '#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f472b6'];

function tint(depth: number): string {
  return BRANCH[Math.min(depth, BRANCH.length - 1)];
}

function Node({ node }: { node: PlacedMind }) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const accent = tint(node.depth);
  const label = (
    <text
      x={cx}
      y={cy + 4.5}
      textAnchor="middle"
      fontSize={node.depth === 0 ? 14 : 12.5}
      fill="var(--xd-fg)"
      fontFamily={FONT}
      fontWeight={node.depth === 0 ? 700 : 500}
    >
      {node.label}
    </text>
  );

  if (node.shape === 'circle') {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={node.w / 2} ry={node.h / 2} fill="var(--xd-surface-alt)" stroke={accent} strokeWidth={2} />
        {label}
      </g>
    );
  }

  if (node.shape === 'bang') {
    return (
      <g>
        <path
          d={`M${node.x + 6},${cy - node.h / 2} h${node.w - 12} q6,0 6,6 v${node.h - 12} q0,6 -6,6 h-${node.w - 12} q-6,0 -6,-6 v-${node.h - 12} q0,-6 6,-6 z`}
          fill="color-mix(in srgb, var(--xd-warning, #f59e0b) 18%, var(--xd-surface-alt))"
          stroke={accent}
          strokeWidth={1.6}
        />
        {label}
      </g>
    );
  }

  if (node.shape === 'cloud') {
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={node.w / 2 + 8} ry={node.h / 2 + 4} fill="var(--xd-surface)" stroke={accent} strokeWidth={1.4} strokeDasharray="5 3" />
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
        rx={node.shape === 'rect' ? 4 : node.h / 2}
        fill="var(--xd-surface-alt)"
        stroke={accent}
        strokeWidth={node.depth === 0 ? 2 : 1.4}
      />
      {label}
    </g>
  );
}

function flatten(node: PlacedMind, out: PlacedMind[] = []): PlacedMind[] {
  out.push(node);
  node.children.forEach(child => flatten(child, out));
  return out;
}

export default function MindmapCanvas({
  model,
  onFitView,
}: {
  model: MindModel;
  onFitView?: FitRegistrar;
}) {
  const layout = useMemo(() => layoutMindmap(model.root), [model.root]);
  const nodes = useMemo(() => (layout.root ? flatten(layout.root) : []), [layout.root]);
  const panZoom = usePanZoom();
  const { fit } = panZoom;

  useEffect(() => {
    if (layout.width > 0) fit(layout.width, layout.height);
  }, [layout.width, layout.height, fit]);

  useEffect(() => {
    if (!onFitView) return;
    onFitView(() => fit(layout.width, layout.height));
  }, [onFitView, fit, layout.width, layout.height]);

  if (!layout.root) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Add a root node to see the mindmap.
      </div>
    );
  }

  return (
    <div
      ref={panZoom.hostRef}
      data-testid="mindmap-canvas"
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
          {layout.links.map((link, i) => (
            <path key={i} d={link.d} fill="none" stroke={tint(link.depth)} strokeWidth={1.6} opacity={0.8} />
          ))}
          {nodes.map(node => (
            <Node key={node.id} node={node} />
          ))}
        </g>
      </svg>
      <ZoomPanel panZoom={panZoom} />
    </div>
  );
}
