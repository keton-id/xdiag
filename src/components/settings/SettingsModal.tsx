/**
 * SettingsModal.tsx
 * Palette, colour overrides and behaviour toggles. Persisted in localStorage.
 */

import { X, Check, Palette as PaletteIcon } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  PALETTES,
  resolvePalette,
  type Settings,
} from '../../theme';

interface SettingsModalProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm text-gray-200">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 mt-0.5 h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? fallback}
          onChange={e => onChange(e.target.value)}
          className="h-6 w-9 cursor-pointer rounded border border-slate-700 bg-slate-800 p-0"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={value === null}
          className="text-[11px] text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const palette = resolvePalette(settings);
  const patch = (p: Partial<Settings>) => onChange({ ...settings, ...p });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Settings"
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <PaletteIcon size={15} className="text-indigo-400" />
            Settings
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Palette presets */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Palette</p>
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map(p => {
              const active = p.id === settings.palette;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => patch({ palette: p.id, accent: null, background: null, edge: null })}
                  data-testid={`palette-${p.id}`}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <span className="flex shrink-0 overflow-hidden rounded border border-black/40">
                    {[p.bg, p.surfaceAlt, p.accent, p.edgeActive].map(c => (
                      <span key={c} className="h-5 w-2.5" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="flex-1 truncate text-xs text-gray-200">{p.name}</span>
                  {active && <Check size={13} className="text-indigo-400" />}
                </button>
              );
            })}
          </div>

          {/* Colour overrides */}
          <p className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Colours</p>
          <ColorRow
            label="Accent"
            value={settings.accent}
            fallback={palette.accent}
            onChange={v => patch({ accent: v })}
          />
          <ColorRow
            label="Background"
            value={settings.background}
            fallback={palette.bg}
            onChange={v => patch({ background: v })}
          />
          <ColorRow
            label="Relations"
            value={settings.edge}
            fallback={palette.edge}
            onChange={v => patch({ edge: v })}
          />

          {/* Behaviour */}
          <p className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Behaviour</p>
          <Toggle
            label="Animate sidebar"
            description="Slide the editor open and closed instead of snapping"
            checked={settings.animateCollapse}
            onChange={v => patch({ animateCollapse: v })}
          />
          <Toggle
            label="Show minimap"
            description="Overview map in the bottom-right corner"
            checked={settings.showMinimap}
            onChange={v => patch({ showMinimap: v })}
          />
          <Toggle
            label="Show grid"
            description="Dot grid behind the diagram"
            checked={settings.showGrid}
            onChange={v => patch({ showGrid: v })}
          />

          {/* Flow animation */}
          <p className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Relation flow
          </p>
          <label className="block py-1.5">
            <span className="flex items-center justify-between text-sm text-gray-300">
              Speed
              <span className="font-mono text-xs text-slate-400">{settings.flowSpeed.toFixed(1)}s</span>
            </span>
            <input
              type="range"
              min={0.4}
              max={4}
              step={0.1}
              value={settings.flowSpeed}
              onChange={e => patch({ flowSpeed: Number(e.target.value) })}
              className="mt-1 w-full accent-indigo-500"
              aria-label="Flow animation speed"
            />
          </label>
          <label className="block py-1.5">
            <span className="flex items-center justify-between text-sm text-gray-300">
              Thickness
              <span className="font-mono text-xs text-slate-400">{settings.flowWidth.toFixed(1)}px</span>
            </span>
            <input
              type="range"
              min={1.5}
              max={7}
              step={0.5}
              value={settings.flowWidth}
              onChange={e => patch({ flowWidth: Number(e.target.value) })}
              className="mt-1 w-full accent-indigo-500"
              aria-label="Flow line thickness"
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="text-xs text-slate-400 hover:text-white"
          >
            Restore defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
