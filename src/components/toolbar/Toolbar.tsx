/**
 * Toolbar.tsx
 * Top navbar: diagram title, Auto Arrange, direction toggle, Zoom to Fit, Load Sample, Export.
 */

import { useState } from 'react';
import { LayoutDashboard, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Maximize2, FolderOpen, Download, Settings } from 'lucide-react';
import type { LayoutDirection } from '../../engine/layout';

interface ToolbarProps {
  title: string;
  direction: LayoutDirection;
  onAutoArrange: () => void;
  onDirectionChange: (d: LayoutDirection) => void;
  onZoomToFit: () => void;
  onLoadSample: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

export default function Toolbar({
  title,
  direction,
  onAutoArrange,
  onDirectionChange,
  onZoomToFit,
  onLoadSample,
  onExport,
  onOpenSettings,
}: ToolbarProps) {
  const [dirOpen, setDirOpen] = useState(false);

  return (
    <header
      className="flex items-center justify-between px-4 py-2 border-b shrink-0 gap-3 z-10"
      style={{ background: 'var(--xd-surface)', borderColor: 'var(--xd-border)' }}
    >
      {/* Brand / title */}
      <div className="flex items-center gap-2 min-w-0">
        <LayoutDashboard size={18} className="shrink-0" style={{ color: 'var(--xd-accent-soft)' }} />
        <span className="font-bold text-white tracking-tight truncate">{title}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Auto Arrange */}
        <button
          onClick={onAutoArrange}
          title="Auto Arrange"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <AlignHorizontalDistributeCenter size={15} />
          <span className="hidden sm:inline">Auto Arrange</span>
        </button>

        {/* Layout Direction toggle */}
        <div className="relative">
          <button
            onClick={() => setDirOpen(p => !p)}
            title="Layout Direction"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {direction === 'LR'
              ? <AlignHorizontalDistributeCenter size={15} />
              : <AlignVerticalDistributeCenter size={15} />}
            <span className="hidden sm:inline">{direction === 'LR' ? 'Horizontal' : 'Vertical'}</span>
          </button>
          {dirOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
              {(['LR', 'TB'] as LayoutDirection[]).map(d => (
                <button
                  key={d}
                  onClick={() => { onDirectionChange(d); setDirOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    direction === d ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {d === 'LR' ? '→ Horizontal (LR)' : '↓ Vertical (TB)'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom to Fit */}
        <button
          onClick={onZoomToFit}
          title="Zoom to Fit"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <Maximize2 size={15} />
          <span className="hidden sm:inline">Fit</span>
        </button>

        <div className="w-px h-5 mx-1" style={{ background: 'var(--xd-border)' }} />

        {/* Load Sample */}
        <button
          onClick={onLoadSample}
          title="Load Sample"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <FolderOpen size={15} />
          <span className="hidden sm:inline">Sample</span>
        </button>
        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <Settings size={15} />
          <span className="hidden sm:inline">Settings</span>
        </button>
        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--xd-accent)' }}
        >
          <Download size={15} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  );
}
