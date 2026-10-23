/**
 * ZoomPanel.tsx
 * Floating zoom controls for the SVG canvases, mirroring the ERD panel.
 */

import { Maximize2, Minus, Plus } from 'lucide-react';
import type { PanZoom } from './usePanZoom';

const BUTTON =
  'flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/10 hover:text-white';

export default function ZoomPanel({ panZoom }: { panZoom: PanZoom }) {
  return (
    <div
      data-testid="zoom-controls"
      className="nodrag nopan absolute bottom-4 left-4 z-10 flex items-center gap-0.5 rounded-lg border p-1 shadow-lg backdrop-blur"
      style={{
        background: 'color-mix(in srgb, var(--xd-surface) 92%, transparent)',
        borderColor: 'var(--xd-border)',
      }}
    >
      <button type="button" className={BUTTON} onClick={panZoom.zoomOut} title="Zoom out">
        <Minus size={14} />
      </button>
      <span className="w-11 text-center text-[11px] font-mono tabular-nums text-slate-300" data-testid="zoom-level">
        {Math.round(panZoom.view.k * 100)}%
      </span>
      <button type="button" className={BUTTON} onClick={panZoom.zoomIn} title="Zoom in">
        <Plus size={14} />
      </button>
      <div className="mx-1 h-4 w-px" style={{ background: 'var(--xd-border)' }} />
      <button type="button" className={BUTTON} onClick={panZoom.reset} title="Zoom to fit (f)">
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
