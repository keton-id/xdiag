/**
 * ZoomControls.tsx
 * Custom canvas navigation panel: zoom in/out, fit, reset to 100%, live level.
 */

import { useCallback, useEffect } from 'react';
import { getNodesBounds, useReactFlow, useStore } from '@xyflow/react';
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';

const BUTTON =
  'flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/10 hover:text-white';

function ZoomControls() {
  // Store subscription keeps the readout in sync with wheel/pinch zooming too.
  const zoom = useStore(s => s.transform[2]);
  const width = useStore(s => s.width);
  const height = useStore(s => s.height);
  const { zoomIn, zoomOut, fitView, setViewport, getNodes } = useReactFlow();

  const reset = useCallback(() => {
    const bounds = getNodesBounds(getNodes());
    setViewport(
      {
        x: width / 2 - bounds.x - bounds.width / 2,
        y: height / 2 - bounds.y - bounds.height / 2,
        zoom: 1,
      },
      { duration: 300 },
    );
  }, [getNodes, setViewport, width, height]);

  // +/=/−/0/f shortcuts. Ignored while typing in the DBML editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"], .cm-editor')) return;
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn({ duration: 200 });
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut({ duration: 200 });
          break;
        case '0':
          e.preventDefault();
          reset();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          fitView({ padding: 0.15, duration: 300 });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIn, zoomOut, fitView, reset]);

  return (
    <div
      data-testid="zoom-controls"
      className="nodrag nopan absolute bottom-4 left-4 z-10 flex items-center gap-0.5 rounded-lg border p-1 shadow-lg backdrop-blur"
      style={{
        background: 'color-mix(in srgb, var(--xd-surface) 92%, transparent)',
        borderColor: 'var(--xd-border)',
      }}
    >
      <button type="button" className={BUTTON} onClick={() => zoomOut({ duration: 200 })} title="Zoom out (-)">
        <Minus size={14} />
      </button>
      <span
        className="w-11 text-center text-[11px] font-mono tabular-nums text-slate-300"
        data-testid="zoom-level"
      >
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" className={BUTTON} onClick={() => zoomIn({ duration: 200 })} title="Zoom in (+)">
        <Plus size={14} />
      </button>
      <div className="mx-1 h-4 w-px" style={{ background: 'var(--xd-border)' }} />
      <button
        type="button"
        className={BUTTON}
        onClick={() => fitView({ padding: 0.15, duration: 300 })}
        title="Zoom to fit (f)"
      >
        <Maximize2 size={14} />
      </button>
      <button
        type="button"
        className={BUTTON}
        onClick={reset}
        title="Reset zoom to 100% (0)"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}

export default ZoomControls;
