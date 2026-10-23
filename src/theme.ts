/**
 * theme.ts
 * User settings + palette tokens. Everything visual reads CSS custom
 * properties so custom nodes/edges can be recoloured at runtime.
 */

export interface Palette {
  id: string;
  name: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  accent: string;
  accentSoft: string;
  edge: string;
  edgeActive: string;
  grid: string;
  /** Body text and dimmed labels — the SVG canvases paint with these. */
  fg: string;
  muted: string;
}

export const PALETTES: Palette[] = [
  {
    id: 'indigo',
    name: 'Indigo Slate',
    bg: '#020617',
    surface: '#0f172a',
    surfaceAlt: '#1e2130',
    border: '#334155',
    accent: '#6366f1',
    accentSoft: '#a5b4fc',
    edge: '#6366f1',
    edgeActive: '#c7d2fe',
    grid: '#334155',
    fg: '#e2e8f0',
    muted: '#94a3b8',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bg: '#04121a',
    surface: '#0b2230',
    surfaceAlt: '#102c3d',
    border: '#1e4457',
    accent: '#0ea5e9',
    accentSoft: '#7dd3fc',
    edge: '#0ea5e9',
    edgeActive: '#bae6fd',
    grid: '#1e4457',
    fg: '#e0f2fe',
    muted: '#8fb3c7',
  },
  {
    id: 'forest',
    name: 'Forest',
    bg: '#03130d',
    surface: '#0b2419',
    surfaceAlt: '#123024',
    border: '#245440',
    accent: '#10b981',
    accentSoft: '#6ee7b7',
    edge: '#10b981',
    edgeActive: '#a7f3d0',
    grid: '#245440',
    fg: '#dcfce7',
    muted: '#7fae95',
  },
  {
    id: 'rose',
    name: 'Rose',
    bg: '#17060c',
    surface: '#2a0f18',
    surfaceAlt: '#351524',
    border: '#5a2437',
    accent: '#f43f5e',
    accentSoft: '#fda4af',
    edge: '#f43f5e',
    edgeActive: '#fecdd3',
    grid: '#5a2437',
    fg: '#ffe4e6',
    muted: '#b08a97',
  },
  {
    id: 'amber',
    name: 'Amber',
    bg: '#150f03',
    surface: '#261b08',
    surfaceAlt: '#322410',
    border: '#5c421a',
    accent: '#f59e0b',
    accentSoft: '#fcd34d',
    edge: '#f59e0b',
    edgeActive: '#fde68a',
    grid: '#5c421a',
    fg: '#fef3c7',
    muted: '#bda887',
  },
];

export interface Settings {
  palette: string;
  /** Per-slot overrides; null means "use the palette". */
  accent: string | null;
  background: string | null;
  edge: string | null;
  animateCollapse: boolean;
  /** Seconds for one flow cycle. */
  flowSpeed: number;
  /** Flow line thickness in screen px. */
  flowWidth: number;
  showMinimap: boolean;
  showGrid: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  palette: 'indigo',
  accent: null,
  background: null,
  edge: null,
  animateCollapse: true,
  flowSpeed: 1.6,
  flowWidth: 3.5,
  showMinimap: true,
  showGrid: true,
};

const STORAGE_KEY = 'xdiag_settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

export function resolvePalette(settings: Settings): Palette {
  return PALETTES.find(p => p.id === settings.palette) ?? PALETTES[0];
}

/** Writes the active palette (plus overrides) onto `document.documentElement`. */
export function applySettings(settings: Settings) {
  const palette = resolvePalette(settings);
  const root = document.documentElement.style;
  const accent = settings.accent ?? palette.accent;
  const edge = settings.edge ?? palette.edge;
  // Lightened derivatives follow an override so markers/hover stay coherent.
  const accentSoft = settings.accent
    ? `color-mix(in srgb, ${accent} 55%, white)`
    : palette.accentSoft;
  const edgeActive = settings.edge
    ? `color-mix(in srgb, ${edge} 40%, white)`
    : palette.edgeActive;

  root.setProperty('--xd-bg', settings.background ?? palette.bg);
  root.setProperty('--xd-surface', palette.surface);
  root.setProperty('--xd-surface-alt', palette.surfaceAlt);
  root.setProperty('--xd-border', palette.border);
  root.setProperty('--xd-accent', accent);
  root.setProperty('--xd-accent-soft', accentSoft);
  root.setProperty('--xd-edge', edge);
  root.setProperty('--xd-edge-active', edgeActive);
  root.setProperty('--xd-grid', palette.grid);
  root.setProperty('--xd-fg', palette.fg);
  root.setProperty('--xd-muted', palette.muted);
  root.setProperty('--xd-flow-duration', `${settings.flowSpeed}s`);
  root.setProperty('--xd-flow-width', `${settings.flowWidth}px`);
}
