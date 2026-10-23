/**
 * SequenceCanvas.tsx
 * Hand-rolled SVG sequence renderer. Layout comes from `layout.ts`; this file
 * only maps geometry to elements and wires pan/zoom.
 */

import { useEffect, useMemo } from 'react';

import type { SequenceModel } from '../../../kinds/types';
import type { FitRegistrar } from '../fit';
import { usePanZoom } from '../usePanZoom';
import ZoomPanel from '../ZoomPanel';
import { layoutSequence, type FrameBox, type Lifeline, type MessageLine, type NoteBox, type SelfMessageLine } from './layout';

const FONT = 'ui-sans-serif, system-ui, sans-serif';

function arrowHead(head: MessageLine['head'], x: number, y: number, dir: 1 | -1) {
  const tip = x + dir * 1;
  if (head === 'cross') {
    return (
      <g stroke="var(--xd-edge)" strokeWidth={1.5}>
        <line x1={tip - 5} y1={y - 5} x2={tip + 4} y2={y + 5} />
        <line x1={tip - 5} y1={y + 5} x2={tip + 4} y2={y - 5} />
      </g>
    );
  }
  return (
    <path
      d={`M${tip},${y} L${tip - dir * 9},${y - 4.5} L${tip - dir * 9},${y + 4.5} Z`}
      fill={head === 'filled' ? 'var(--xd-edge-active)' : 'var(--xd-bg)'}
      stroke="var(--xd-edge-active)"
      strokeWidth={1}
    />
  );
}

function LifelineHead({ line }: { line: Lifeline }) {
  const x = line.centerX - line.boxW / 2;
  const stroke = 'var(--xd-edge)';

  if (line.actor) {
    const cx = line.centerX;
    return (
      <g stroke={stroke} fill="none" strokeWidth={1.5}>
        <circle cx={cx} cy={line.boxTop + 10} r={7} />
        <line x1={cx} y1={line.boxTop + 17} x2={cx} y2={line.boxTop + 34} />
        <line x1={cx - 13} y1={line.boxTop + 24} x2={cx + 13} y2={line.boxTop + 24} />
        <line x1={cx} y1={line.boxTop + 34} x2={cx - 10} y2={line.boxTop + 48} />
        <line x1={cx} y1={line.boxTop + 34} x2={cx + 10} y2={line.boxTop + 48} />
        <text
          x={cx}
          y={line.boxTop + 62}
          textAnchor="middle"
          fontSize={13}
          fill="var(--xd-fg)"
          stroke="none"
          fontFamily={FONT}
          fontWeight={600}
        >
          {line.label}
        </text>
      </g>
    );
  }

  return (
    <g>
      <rect
        x={x}
        y={line.boxTop}
        width={line.boxW}
        height={line.boxH}
        rx={6}
        fill="var(--xd-surface-alt)"
        stroke="var(--xd-border)"
        strokeWidth={1}
      />
      <text
        x={line.centerX}
        y={line.boxTop + line.boxH / 2 + 4.5}
        textAnchor="middle"
        fontSize={13}
        fill="var(--xd-fg)"
        fontFamily={FONT}
        fontWeight={600}
      >
        {line.label}
      </text>
    </g>
  );
}

function Message({ shape }: { shape: MessageLine }) {
  const dir: 1 | -1 = shape.x2 >= shape.x1 ? 1 : -1;
  const mid = (shape.x1 + shape.x2) / 2;
  const tx = mid;
  const anchor = 'middle';
  return (
    <g>
      <line
        x1={shape.x1}
        y1={shape.y}
        x2={shape.x2 - dir * 8}
        y2={shape.y}
        stroke="var(--xd-edge-active)"
        strokeWidth={1.5}
        strokeDasharray={shape.dashed ? '6 4' : undefined}
      />
      {arrowHead(shape.head, shape.x2 - dir * 8, shape.y, dir)}
      {shape.text && (
        <text
          x={tx}
          y={shape.y - 8}
          textAnchor={anchor}
          fontSize={12}
          fill="var(--xd-fg)"
          fontFamily={FONT}
          stroke="var(--xd-bg)"
          strokeWidth={5}
          paintOrder="stroke"
        >
          {shape.text}
        </text>
      )}
    </g>
  );
}

function SelfMessage({ shape }: { shape: SelfMessageLine }) {
  const x = shape.x;
  const d = `M${x},${shape.y} h28 v26 h-28`;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="var(--xd-edge-active)"
        strokeWidth={1.5}
        strokeDasharray={shape.dashed ? '6 4' : undefined}
      />
      {arrowHead(shape.head, x, shape.y + 26, -1)}
      {shape.text && (
        <text
          x={x + 36}
          y={shape.y + 8}
          fontSize={12}
          fill="var(--xd-fg)"
          fontFamily={FONT}
          stroke="var(--xd-bg)"
          strokeWidth={5}
          paintOrder="stroke"
        >
          {shape.text}
        </text>
      )}
    </g>
  );
}

function Note({ shape }: { shape: NoteBox }) {
  return (
    <g>
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={4}
        fill="color-mix(in srgb, var(--xd-accent) 16%, transparent)"
        stroke="var(--xd-accent)"
        strokeWidth={1}
      />
      {shape.lines.map((line, i) => (
        <text
          key={i}
          x={shape.x + shape.w / 2}
          y={shape.y + 18 + i * 16}
          textAnchor="middle"
          fontSize={12}
          fill="var(--xd-fg)"
          fontFamily={FONT}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function Frame({ shape }: { shape: FrameBox }) {
  const header = shape.label ? `${shape.tag} ${shape.label}` : shape.tag;
  return (
    <g>
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={4}
        fill="none"
        stroke="var(--xd-border)"
        strokeWidth={1.2}
      />
      <path
        d={`M${shape.x},${shape.y + 20} h${Math.min(160, shape.w)} v-20 z`}
        fill="var(--xd-surface-alt)"
        stroke="var(--xd-border)"
        strokeWidth={1}
      />
      <text x={shape.x + 8} y={shape.y + 14} fontSize={11} fill="var(--xd-muted)" fontFamily={FONT} fontWeight={600}>
        {header}
      </text>
      {shape.dividers.map((divider, i) => (
        <g key={i}>
          <line
            x1={shape.x}
            y1={divider.y}
            x2={shape.x + shape.w}
            y2={divider.y}
            stroke="var(--xd-border)"
            strokeDasharray="4 3"
          />
          <text x={shape.x + 8} y={divider.y + 13} fontSize={11} fill="var(--xd-muted)" fontFamily={FONT}>
            {divider.label ? `${divider.tag} ${divider.label}` : divider.tag}
          </text>
        </g>
      ))}
    </g>
  );
}

export default function SequenceCanvas({
  model,
  onFitView,
}: {
  model: SequenceModel;
  onFitView?: FitRegistrar;
}) {
  const layout = useMemo(() => layoutSequence(model), [model]);
  const panZoom = usePanZoom();
  const { fit } = panZoom;

  useEffect(() => {
    if (layout.width > 0) fit(layout.width, layout.height);
  }, [layout.width, layout.height, fit]);

  useEffect(() => {
    if (!onFitView) return;
    onFitView(() => fit(layout.width, layout.height));
  }, [onFitView, fit, layout.width, layout.height]);

  if (layout.width === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Add participants to see the sequence.
      </div>
    );
  }

  return (
    <div
      ref={panZoom.hostRef}
      data-testid="sequence-canvas"
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
          {layout.shapes
            .filter(shape => shape.kind === 'frame')
            .map((shape, i) => (
              <Frame key={`f${i}`} shape={shape} />
            ))}
          {layout.lifelines.map(line => (
            <line
              key={`l-${line.id}`}
              x1={line.centerX}
              y1={line.boxTop + line.boxH}
              x2={line.centerX}
              y2={line.bottom}
              stroke="var(--xd-border)"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
          ))}
          {layout.activations.map((bar, i) => (
            <rect
              key={`a${i}`}
              x={bar.x}
              y={bar.y}
              width={10}
              height={bar.h}
              rx={2}
              fill="var(--xd-surface-alt)"
              stroke="var(--xd-accent)"
              strokeWidth={1}
            />
          ))}
          {layout.shapes
            .filter(shape => shape.kind !== 'frame')
            .map((shape, i) => {
              if (shape.kind === 'message') return <Message key={i} shape={shape} />;
              if (shape.kind === 'self') return <SelfMessage key={i} shape={shape} />;
              return <Note key={i} shape={shape} />;
            })}
          {layout.lifelines.map(line => (
            <LifelineHead key={`h-${line.id}`} line={line} />
          ))}
        </g>
      </svg>
      <ZoomPanel panZoom={panZoom} />
    </div>
  );
}
