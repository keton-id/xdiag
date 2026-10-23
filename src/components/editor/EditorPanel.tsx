/**
 * EditorPanel.tsx
 * Source editor built on CodeMirror 6: per-kind syntax highlighting, line
 * numbers, folds and error-line marking.
 */

import { useEffect, useRef } from 'react';
import { AlertCircle, ChevronsDownUp, ChevronsUpDown, FileCode2 } from 'lucide-react';
import { EditorView, lineNumbers, highlightActiveLine, keymap, Decoration, type DecorationSet } from '@codemirror/view';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, codeFolding, foldAll, foldGutter, foldKeymap, indentOnInput, unfoldAll } from '@codemirror/language';

import { KINDS } from '../../kinds/registry';
import type { DiagramError, DiagramKind } from '../../kinds/types';
import { diagramTheme, highlightExtension, languageExtension } from './languages';

interface EditorPanelProps {
  value: string;
  kind: DiagramKind;
  onChange: (v: string) => void;
  error: DiagramError | null;
  onLoadSample: () => void;
}

// ─── Error line decoration ────────────────────────────────────────────────────

const setErrorLine = StateEffect.define<number | null>();

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue;
      const line = effect.value;
      next = Decoration.none;
      if (line !== null && line >= 1 && line <= tr.state.doc.lines) {
        next = Decoration.set([
          Decoration.line({ class: 'cm-error-line' }).range(tr.state.doc.line(line).from),
        ]);
      }
    }
    return next;
  },
  provide: field => EditorView.decorations.from(field),
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditorPanel({ value, kind, onChange, error, onLoadSample }: EditorPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          foldGutter(),
          codeFolding(),
          bracketMatching(),
          indentOnInput(),
          highlightActiveLine(),
          history(),
          languageExtension(kind),
          highlightExtension,
          errorLineField,
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          keymap.of([...foldKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
          diagramTheme,
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once per kind: text changes are pushed in through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // Keep the document in sync when the parent replaces the text wholesale
  // (switching files, Load Sample). Skips echo from our own onChange.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value, kind]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(error?.line ?? null) });
  }, [error]);

  const runFoldCommand = (command: typeof foldAll) => {
    const view = viewRef.current;
    if (view) command(view);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: 'var(--xd-surface)' }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-2"
        style={{ borderColor: 'var(--xd-border)' }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <FileCode2 size={14} style={{ color: 'var(--xd-accent-soft)' }} />
          {KINDS[kind].language}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => runFoldCommand(foldAll)}
            title="Fold all blocks"
            aria-label="Fold all blocks"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <ChevronsDownUp size={14} />
          </button>
          <button
            onClick={() => runFoldCommand(unfoldAll)}
            title="Unfold all"
            aria-label="Unfold all"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <ChevronsUpDown size={14} />
          </button>
          <button
            onClick={onLoadSample}
            className="ml-1 rounded px-2 py-1 text-xs text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--xd-accent)' }}
          >
            Load Sample
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div ref={hostRef} className="flex-1 overflow-hidden" />

      {/* Error bar */}
      {error && (
        <div className="flex shrink-0 items-start gap-2 border-t border-red-800/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" />
          <span className="break-all font-mono">{error.message}</span>
        </div>
      )}
    </div>
  );
}
