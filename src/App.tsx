/**
 * App.tsx
 * Root application: project state (documents + active file), the split editor,
 * kind dispatch to the right canvas, and the export/settings modals.
 */

import { lazy, Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { KINDS } from './kinds/registry';
import type { DiagramKind, KindDocument } from './kinds/types';
import type { LayoutDirection } from './engine/layout';
import {
  createDocument,
  loadProject,
  parseProject,
  saveProject,
  serializeProject,
  type Project,
} from './project/store';

import FileList from './components/files/FileList';
import Toolbar from './components/toolbar/Toolbar';
import EditorPanel from './components/editor/EditorPanel';
import ERDCanvas from './components/canvas/ERDCanvas';
import ExportModal from './components/export/ExportModal';
import SettingsModal from './components/settings/SettingsModal';
import { downloadText } from './components/svg/exportSvg';
import { applySettings, loadSettings, saveSettings, type Settings } from './theme';

// Non-ERD renderers live in their own chunks: opening xdiag must not download
// three renderers the active file never uses.
const SequenceCanvas = lazy(() => import('./components/svg/sequence/SequenceCanvas'));
const FlowchartCanvas = lazy(() => import('./components/svg/flowchart/FlowchartCanvas'));
const MindmapCanvas = lazy(() => import('./components/svg/mindmap/MindmapCanvas'));

import './index.css';

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [project, setProject] = useState<Project>(loadProject);
  const [direction, setDirection] = useState<LayoutDirection>('LR');
  const [layoutKey, setLayoutKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [projectError, setProjectError] = useState<string | null>(null);

  const active = project.documents.find(d => d.id === project.activeId) ?? project.documents[0];
  const spec = KINDS[active.kind];
  // Keep the last document that parsed so a mid-edit typo shows the error bar
  // over the previous good drawing instead of blanking the canvas.
  const lastGood = useRef<KindDocument | null>(null);
  const parsed = useMemo(() => {
    const next = spec.parse(active.source, lastGood.current ?? undefined);
    if (!next.error) lastGood.current = next;
    return next;
  }, [spec, active.source]);

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveProject(project);
  }, [project]);

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

  const fitViewRef = useRef<(() => void) | null>(null);
  const registerFitView = useCallback((fn: () => void) => { fitViewRef.current = fn; }, []);

  function updateActiveSource(source: string) {
    setProject(prev => ({
      ...prev,
      documents: prev.documents.map(d => (d.id === prev.activeId ? { ...d, source } : d)),
    }));
  }

  function handleSelect(id: string) {
    setProject(prev => ({ ...prev, activeId: id }));
    setLayoutKey(k => k + 1);
  }

  function handleAdd(kind: DiagramKind) {
    setProject(prev => {
      const doc = createDocument(kind, prev.documents);
      return { documents: [...prev.documents, doc], activeId: doc.id };
    });
    setLayoutKey(k => k + 1);
  }

  function handleRename(id: string, name: string) {
    setProject(prev => ({
      ...prev,
      documents: prev.documents.map(d => (d.id === id ? { ...d, name } : d)),
    }));
  }

  function handleDelete(id: string) {
    setProject(prev => {
      if (prev.documents.length === 1) return prev;
      const documents = prev.documents.filter(d => d.id !== id);
      return { documents, activeId: prev.activeId === id ? documents[0].id : prev.activeId };
    });
  }

  function handleLoadSample() {
    updateActiveSource(spec.sample);
    setLayoutKey(k => k + 1);
  }

  function handleAutoArrange() {
    setLayoutKey(k => k + 1);
  }

  function handleDirectionChange(d: LayoutDirection) {
    setDirection(d);
    setLayoutKey(k => k + 1);
  }

  function handleExportProject() {
    downloadText(serializeProject(project), 'xdiag-project.json', 'application/json');
  }

  async function handleImportProject(file: File) {
    try {
      const next = parseProject(JSON.parse(await file.text()));
      setProject(next);
      setProjectError(null);
      setLayoutKey(k => k + 1);
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Invalid project file');
    }
  }

  const schema = parsed.kind === 'erd' ? parsed.schema : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden text-white" style={{ background: 'var(--xd-bg)' }}>
      <Toolbar
        title={active.name}
        kind={active.kind}
        direction={direction}
        onAutoArrange={handleAutoArrange}
        onDirectionChange={handleDirectionChange}
        onZoomToFit={() => fitViewRef.current?.()}
        onLoadSample={handleLoadSample}
        onExport={() => setShowExport(true)}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
        onOpenSettings={() => setShowSettings(true)}
      />

      {projectError && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-red-800/50 bg-red-950/40 px-4 py-1.5 text-xs text-red-300">
          <span>Import failed: {projectError}</span>
          <button onClick={() => setProjectError(null)} className="text-red-300 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Main split: editor left, canvas right */}
      <div className={`relative flex flex-1 overflow-hidden ${isDragging ? 'cursor-col-resize select-none' : ''}`}>
        {/*
          Always mounted so CodeMirror keeps its state across collapse/expand;
          the container width animates to zero instead.
        */}
        <div
          data-testid="editor-container"
          style={{
            width: isCollapsed ? 0 : editorWidth,
            opacity: isCollapsed ? 0 : 1,
            borderRight: '1px solid var(--xd-border)',
            background: 'var(--xd-surface)',
          }}
          className={`hidden h-full shrink-0 flex-col overflow-hidden md:flex ${
            settings.animateCollapse ? 'xdiag-animate-width' : ''
          }`}
          aria-hidden={isCollapsed}
        >
          <FileList
            documents={project.documents}
            activeId={active.id}
            onSelect={handleSelect}
            onAdd={handleAdd}
            onRename={handleRename}
            onDelete={handleDelete}
          />
          <EditorPanel
            value={active.source}
            kind={active.kind}
            onChange={updateActiveSource}
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
          className={`group relative z-10 hidden shrink-0 cursor-col-resize select-none items-center justify-center border-x transition-colors md:flex ${
            isDragging ? 'bg-indigo-600/30' : 'hover:bg-indigo-600/20'
          }`}
          title="Drag to resize editor (Double-click to reset to 380px)"
        >
          <div
            className={`h-8 w-0.5 rounded-full transition-colors ${
              isDragging ? 'bg-indigo-400' : 'bg-slate-600 group-hover:bg-indigo-400'
            }`}
          />

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
            className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 shadow-xl backdrop-blur transition-all hover:bg-slate-800 hover:text-white"
            title="Expand editor"
          >
            <svg className="h-3.5 w-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Show Editor</span>
          </button>
        )}

        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden">
          <Canvas kindDocument={parsed} direction={direction} layoutKey={layoutKey} settings={settings} onFitView={registerFitView} />
        </div>
      </div>

      {showExport && (
        <ExportModal
          kind={active.kind}
          source={active.source}
          schema={schema}
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

function Canvas({
  kindDocument,
  direction,
  layoutKey,
  settings,
  onFitView,
}: {
  kindDocument: KindDocument;
  direction: LayoutDirection;
  layoutKey: number;
  settings: Settings;
  onFitView: (fn: () => void) => void;
}) {
  if (kindDocument.kind === 'erd') {
    return (
      <ReactFlowProvider>
        <ERDCanvas
          schema={kindDocument.schema}
          direction={direction}
          layoutKey={layoutKey}
          settings={settings}
          onFitView={onFitView}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-xs text-slate-500">Loading renderer…</div>
      }
    >
      {kindDocument.kind === 'sequence' && <SequenceCanvas model={kindDocument.model} onFitView={onFitView} />}
      {kindDocument.kind === 'flowchart' && <FlowchartCanvas model={kindDocument.model} onFitView={onFitView} />}
      {kindDocument.kind === 'mindmap' && <MindmapCanvas model={kindDocument.model} onFitView={onFitView} />}
    </Suspense>
  );
}
