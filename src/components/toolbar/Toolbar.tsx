/**
 * Toolbar.tsx
 * Top navbar. Which actions appear is read from the active kind's registry
 * entry, so a kind never shows a button that would do nothing.
 */

import { useRef, useState } from 'react';
import {
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Download,
  FileJson2,
  FolderOpen,
  LayoutDashboard,
  Maximize2,
  Settings,
  Upload,
} from 'lucide-react';

import { KINDS } from '../../kinds/registry';
import type { DiagramKind } from '../../kinds/types';
import type { LayoutDirection } from '../../engine/layout';

interface ToolbarProps {
  title: string;
  kind: DiagramKind;
  direction: LayoutDirection;
  onAutoArrange: () => void;
  onDirectionChange: (d: LayoutDirection) => void;
  onZoomToFit: () => void;
  onLoadSample: () => void;
  onExport: () => void;
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onOpenSettings: () => void;
}

const ITEM =
  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-slate-700 transition-colors';

export default function Toolbar({
  title,
  kind,
  direction,
  onAutoArrange,
  onDirectionChange,
  onZoomToFit,
  onLoadSample,
  onExport,
  onExportProject,
  onImportProject,
  onOpenSettings,
}: ToolbarProps) {
  const [dirOpen, setDirOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const spec = KINDS[kind];
  const KindIcon = spec.icon;

  return (
    <header
      className="z-10 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2"
      style={{ background: 'var(--xd-surface)', borderColor: 'var(--xd-border)' }}
    >
      {/* Brand / active file */}
      <div className="flex min-w-0 items-center gap-2">
        <LayoutDashboard size={18} className="shrink-0" style={{ color: 'var(--xd-accent-soft)' }} />
        <span className="truncate font-bold tracking-tight text-white">{title}</span>
        <span
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          style={{
            color: 'var(--xd-accent-soft)',
            background: 'color-mix(in srgb, var(--xd-accent) 18%, transparent)',
          }}
        >
          <KindIcon size={11} />
          {spec.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {spec.actions.includes('arrange') && (
          <button onClick={onAutoArrange} title="Auto Arrange" className={ITEM}>
            <AlignHorizontalDistributeCenter size={15} />
            <span className="hidden sm:inline">Auto Arrange</span>
          </button>
        )}

        {spec.actions.includes('direction') && (
          <div className="relative">
            <button onClick={() => setDirOpen(p => !p)} title="Layout Direction" className={ITEM}>
              {direction === 'LR'
                ? <AlignHorizontalDistributeCenter size={15} />
                : <AlignVerticalDistributeCenter size={15} />}
              <span className="hidden sm:inline">{direction === 'LR' ? 'Horizontal' : 'Vertical'}</span>
            </button>
            {dirOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
                {(['LR', 'TB'] as LayoutDirection[]).map(d => (
                  <button
                    key={d}
                    onClick={() => { onDirectionChange(d); setDirOpen(false); }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      direction === d ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {d === 'LR' ? '→ Horizontal (LR)' : '↓ Vertical (TB)'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={onZoomToFit} title="Zoom to Fit" className={ITEM}>
          <Maximize2 size={15} />
          <span className="hidden sm:inline">Fit</span>
        </button>

        <div className="mx-1 h-5 w-px" style={{ background: 'var(--xd-border)' }} />

        <button onClick={onLoadSample} title="Load Sample" className={ITEM}>
          <FolderOpen size={15} />
          <span className="hidden sm:inline">Sample</span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onImportProject(file);
            e.target.value = '';
          }}
        />
        <button onClick={() => fileRef.current?.click()} title="Import project JSON" aria-label="Import project" className={ITEM}>
          <Upload size={15} />
        </button>
        <button onClick={onExportProject} title="Export project JSON" aria-label="Export project" className={ITEM}>
          <FileJson2 size={15} />
        </button>

        <button onClick={onOpenSettings} title="Settings" aria-label="Settings" className={ITEM}>
          <Settings size={15} />
          <span className="hidden sm:inline">Settings</span>
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--xd-accent)' }}
        >
          <Download size={15} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  );
}
