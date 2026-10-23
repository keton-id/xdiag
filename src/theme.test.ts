import { beforeEach, describe, expect, it } from 'vitest';
import {
  applySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  PALETTES,
  resolvePalette,
  saveSettings,
} from './theme';
import type { Settings } from './theme';

const varOf = (name: string) => document.documentElement.style.getPropertyValue(name);

describe('palettes', () => {
  it('exposes unique ids and every colour token', () => {
    expect(new Set(PALETTES.map(p => p.id)).size).toBe(PALETTES.length);
    for (const palette of PALETTES) {
      for (const key of ['bg', 'surface', 'surfaceAlt', 'border', 'accent', 'edge', 'grid'] as const) {
        expect(palette[key], `${palette.id}.${key}`).toMatch(/^#|^rgb/);
      }
    }
  });

  it('resolves a known palette and falls back to the first for an unknown id', () => {
    expect(resolvePalette({ ...DEFAULT_SETTINGS, palette: 'ocean' }).id).toBe('ocean');
    expect(resolvePalette({ ...DEFAULT_SETTINGS, palette: 'nope' })).toBe(PALETTES[0]);
  });
});

describe('settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a saved settings object', () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      palette: 'forest',
      flowSpeed: 3.2,
      showGrid: false,
    };
    saveSettings(custom);
    expect(loadSettings()).toEqual(custom);
  });

  it('fills in missing keys from defaults (forward compatible)', () => {
    localStorage.setItem('xdiag_settings', JSON.stringify({ palette: 'amber' }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, palette: 'amber' });
  });

  it('survives corrupt JSON', () => {
    localStorage.setItem('xdiag_settings', '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('applySettings', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('writes the palette tokens to the document root', () => {
    applySettings(DEFAULT_SETTINGS);
    const indigo = PALETTES[0];
    expect(varOf('--xd-bg')).toBe(indigo.bg);
    expect(varOf('--xd-accent')).toBe(indigo.accent);
    expect(varOf('--xd-accent-soft')).toBe(indigo.accentSoft);
    expect(varOf('--xd-edge-active')).toBe(indigo.edgeActive);
    expect(varOf('--xd-grid')).toBe(indigo.grid);
    expect(varOf('--xd-fg')).toBe(indigo.fg);
    expect(varOf('--xd-muted')).toBe(indigo.muted);
  });

  it('formats animation tokens as CSS lengths', () => {
    applySettings({ ...DEFAULT_SETTINGS, flowSpeed: 3.2, flowWidth: 5 });
    expect(varOf('--xd-flow-duration')).toBe('3.2s');
    expect(varOf('--xd-flow-width')).toBe('5px');
  });

  it('derives soft/active variants from a colour override', () => {
    applySettings({ ...DEFAULT_SETTINGS, accent: '#ff0000', edge: '#00ff00' });
    expect(varOf('--xd-accent')).toBe('#ff0000');
    expect(varOf('--xd-accent-soft')).toBe('color-mix(in srgb, #ff0000 55%, white)');
    expect(varOf('--xd-edge')).toBe('#00ff00');
    expect(varOf('--xd-edge-active')).toBe('color-mix(in srgb, #00ff00 40%, white)');
  });

  it('applies only the background override, keeping the palette surface', () => {
    applySettings({ ...DEFAULT_SETTINGS, background: '#123456' });
    expect(varOf('--xd-bg')).toBe('#123456');
    expect(varOf('--xd-surface')).toBe(PALETTES[0].surface);
  });

  it('repaints all tokens when the palette changes', () => {
    applySettings(DEFAULT_SETTINGS);
    applySettings({ ...DEFAULT_SETTINGS, palette: 'rose' });
    const rose = PALETTES.find(p => p.id === 'rose')!;
    expect(varOf('--xd-bg')).toBe(rose.bg);
    expect(varOf('--xd-accent')).toBe(rose.accent);
  });
});
