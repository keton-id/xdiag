/**
 * App.tsx
 * Root application: wires editor, canvas, toolbar, and export modal.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { parseDBML } from './engine/dbmlParser';
import { SAMPLE_DBML } from './engine/sampleSchema';
import type { Schema } from './types/schema';
import type { LayoutDirection } from './engine/layout';

import Toolbar from './components/toolbar/Toolbar';
import EditorPanel from './components/editor/EditorPanel';
import ERDCanvas from './components/canvas/ERDCanvas';
import ExportModal from './components/export/ExportModal';
import SettingsModal from './components/settings/SettingsModal';
import { applySettings, loadSettings, saveSettings, type Settings } from './theme';

import './index.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_SCHEMA: Schema = { tables: [], relations: [], enums: [], tableGroups: [] };

interface ParsedState {
  schema: Schema;
  error: { message: string; line?: number } | null;
}

function parseSafe(dbml: string, prevSchema?: Schema): ParsedState {
  const result = parseDBML(dbml);
  if (result.ok) return { schema: result.schema, error: null };
  if (result.partial && result.partial.tables.length > 0) {
    return {
      schema: result.partial,
      error: { message: result.error, line: result.line },
    };
  }
  return {
    schema: prevSchema ?? EMPTY_SCHEMA,
    error: { message: result.error, line: result.line },
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [dbmlText, setDbmlText] = useState(SAMPLE_DBML);
  const [parsed, setParsed] = useState<ParsedState>(() => parseSafe(SAMPLE_DBML));
  const [direction, setDirection] = useState<LayoutDirection>('LR');
  const [layoutKey, setLayoutKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Theme tokens live on <html> so portal-rendered modals inherit them too.
  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  // Resizable & collapsible editor panel state
  const [editorWidth, setEditorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('xdiag_editor_width');
      const val = saved ? parseInt(saved, 10) : 380;
      return isNaN(val) ? 380 : Math.min(Math.max(val, 220), 700);
    } catch {
      return 380;
    }
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startResizing = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, 220), 700);
      setEditorWidth(newWidth);
      try {
        localStorage.setItem('xdiag_editor_width', String(newWidth));
      } catch {
        // ignore storage quota errors
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  // Ref-based fitView handle: ERDCanvas registers its fitView fn here
  const fitViewRef = useRef<(() => void) | null>(null);
  const registerFitView = useCallback((fn: () => void) => { fitViewRef.current = fn; }, []);

  function handleDbmlChange(text: string) {
    setDbmlText(text);
    setParsed(prev => parseSafe(text, prev.schema));
  }

  function handleLoadSample() {
    setDbmlText(SAMPLE_DBML);
    setParsed(parseSafe(SAMPLE_DBML));
    setLayoutKey(k => k + 1);
  }

  function handleAutoArrange() {
    setLayoutKey(k => k + 1);
  }

  function handleDirectionChange(d: LayoutDirection) {
    setDirection(d);
    setLayoutKey(k => k + 1);
  }

  return (
    <div className="flex flex-col h-screen text-white overflow-hidden" style={{ background: 'var(--xd-bg)' }}>
      <Toolbar
        title="xdiag — ERD Creator"
        direction={direction}
        onAutoArrange={handleAutoArrange}
        onDirectionChange={handleDirectionChange}
        onZoomToFit={() => fitViewRef.current?.()}
        onLoadSample={handleLoadSample}
        onExport={() => setShowExport(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main split: editor left, canvas right */}
      <div className={`flex flex-1 overflow-hidden relative ${isDragging ? 'select-none cursor-col-resize' : ''}`}>
        {/*
          Always mounted so CodeMirror keeps its state (and folds) across
          collapse/expand; the container width animates to zero instead.
        */}
        <div
          data-testid="editor-container"
          style={{
            width: isCollapsed ? 0 : editorWidth,
            opacity: isCollapsed ? 0 : 1,
          }}
          className={`hidden md:flex shrink-0 flex-col overflow-hidden h-full ${
            settings.animateCollapse ? 'xdiag-animate-width' : ''
          }`}
          aria-hidden={isCollapsed}
        >
          <EditorPanel
            value={dbmlText}
            onChange={handleDbmlChange}
            error={parsed.error}
            onLoadSample={handleLoadSample}
          />
        </div>

        {/* Resizer splitter — collapses to zero width with the panel */}
        <div
          onPointerDown={startResizing}
          onDoubleClick={() => {
            setEditorWidth(380);
            try { localStorage.setItem('xdiag_editor_width', '380'); } catch {}
          }}
          style={{ width: isCollapsed ? 0 : 12, borderColor: 'var(--xd-border)' }}
          className={`hidden md:flex relative items-center justify-center shrink-0 border-x transition-colors cursor-col-resize select-none group z-10 ${
            isDragging ? 'bg-indigo-600/30' : 'hover:bg-indigo-600/20'
          }`}
          title="Drag to resize editor (Double-click to reset to 380px)"
        >
          {/* Grab indicator */}
          <div
            className={`w-0.5 h-8 rounded-full transition-colors ${
              isDragging ? 'bg-indigo-400' : 'bg-slate-600 group-hover:bg-indigo-400'
            }`}
          />

          {/* Collapse button on splitter */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(true);
              }}
              className="absolute -right-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 shadow-md transition-all hover:bg-slate-700 hover:text-white"
              title="Collapse editor"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Floating Expand button when editor is collapsed */}
        {isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="absolute left-3 top-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 text-slate-300 shadow-xl backdrop-blur hover:bg-slate-800 hover:text-white transition-all text-xs font-medium"
            title="Expand editor"
          >
            <svg className="h-3.5 w-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Show Editor</span>
          </button>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-hidden relative">
          <ReactFlowProvider>
            <ERDCanvas
              schema={parsed.schema}
              direction={direction}
              layoutKey={layoutKey}
              settings={settings}
              onFitView={registerFitView}
            />
          </ReactFlowProvider>
        </div>
      </div>

      {showExport && (
        <ExportModal
          schema={parsed.schema}
          dbmlSource={dbmlText}
          onClose={() => setShowExport(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
