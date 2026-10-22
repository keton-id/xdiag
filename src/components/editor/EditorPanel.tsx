/**
 * EditorPanel.tsx
 * DBML editor built on CodeMirror 6: syntax highlighting, line numbers,
 * collapsible `Table`/`Enum`/`TableGroup` blocks, and error-line marking.
 */

import { useEffect, useRef } from 'react';
import { AlertCircle, ChevronsDownUp, ChevronsUpDown, FileCode2 } from 'lucide-react';
import { EditorView, lineNumbers, highlightActiveLine, keymap, Decoration, type DecorationSet } from '@codemirror/view';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  codeFolding,
  foldAll,
  foldGutter,
  foldKeymap,
  foldService,
  indentOnInput,
  syntaxHighlighting,
  unfoldAll,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

interface ParseError {
  message: string;
  line?: number;
}

interface EditorPanelProps {
  value: string;
  onChange: (v: string) => void;
  error: ParseError | null;
  onLoadSample: () => void;
}

// ─── DBML tokenizer ───────────────────────────────────────────────────────────

type BlockKind = 'table' | 'enum' | 'group' | 'project' | 'indexes';

interface DbmlState {
  blockComment: boolean;
  block: BlockKind | null;
  pendingBlock: BlockKind | null;
  depth: number;
  lineFirst: boolean;
  expectType: boolean;
  inSettings: boolean;
}

const SETTING_WORDS: Record<string, true> = {
  pk: true, unique: true, increment: true, not: true, null: true,
  default: true, ref: true, note: true, headercolor: true,
};

const BLOCK_KEYWORDS: Record<string, BlockKind> = {
  Table: 'table',
  Enum: 'enum',
  TableGroup: 'group',
  Project: 'project',
  indexes: 'indexes',
};

const HEADER_RE = /^(TableGroup|Table|Enum|Project|indexes|Ref|Note)(?![\w$])/;
const IDENT_RE = /^[A-Za-z_][\w$]*/;

const dbmlLanguage = StreamLanguage.define<DbmlState>({
  name: 'dbml',
  startState: () => ({
    blockComment: false,
    block: null,
    pendingBlock: null,
    depth: 0,
    lineFirst: true,
    expectType: false,
    inSettings: false,
  }),
  token(stream, state) {
    if (stream.sol()) {
      state.lineFirst = true;
      state.expectType = false;
    }

    if (state.blockComment) {
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.blockComment = false;
      } else {
        stream.skipToEnd();
      }
      return 'comment';
    }

    if (stream.eatSpace()) return null;

    const first = state.lineFirst;
    state.lineFirst = false;

    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      state.blockComment = true;
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.blockComment = false;
      } else {
        stream.skipToEnd();
      }
      return 'comment';
    }

    // Strings: quotes and DBML backtick expressions.
    if (stream.match(/^'(?:[^'\\]|\\.)*'?/) || stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^`[^`]*`?/)) {
      return 'string';
    }

    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';

    if (stream.match('{')) {
      state.depth += 1;
      if (state.pendingBlock) {
        state.block = state.pendingBlock;
        state.pendingBlock = null;
      }
      return 'brace';
    }
    if (stream.match('}')) {
      state.depth = Math.max(0, state.depth - 1);
      if (state.depth === 0) state.block = null;
      return 'brace';
    }
    if (stream.match('[')) {
      state.inSettings = true;
      return 'bracket';
    }
    if (stream.match(']')) {
      state.inSettings = false;
      return 'bracket';
    }
    if (stream.match(/^[()]/)) return 'bracket';
    if (stream.match(/^[,:]/)) return 'punctuation';
    if (stream.match(/^(?:<>|[-<>])/)) return 'operator';

    if (first) {
      const header = stream.match(HEADER_RE) as RegExpMatchArray | null;
      if (header) {
        const kind = BLOCK_KEYWORDS[header[1]];
        if (kind) state.pendingBlock = kind;
        return 'keyword';
      }
    }

    if (state.inSettings) {
      const word = stream.match(IDENT_RE) as RegExpMatchArray | null;
      if (word) return SETTING_WORDS[word[0].toLowerCase()] ? 'modifier' : 'variableName';
      stream.next();
      return null;
    }

    const ident = stream.match(IDENT_RE) as RegExpMatchArray | null;
    if (ident) {
      if (state.expectType) {
        state.expectType = false;
        return 'typeName';
      }
      if (first && state.block === 'table') {
        state.expectType = true;
        return 'propertyName';
      }
      if (first && state.block === 'enum') return 'labelName';
      return 'variableName';
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
  },
  tokenTable: {
    keyword: tags.keyword,
    typeName: tags.typeName,
    propertyName: tags.propertyName,
    labelName: tags.labelName,
    variableName: tags.variableName,
    modifier: tags.modifier,
    string: tags.string,
    number: tags.number,
    comment: tags.comment,
    bracket: tags.bracket,
    brace: tags.brace,
    punctuation: tags.punctuation,
    operator: tags.operator,
  },
});

/** Folds a `Table x { … }` (or Enum/TableGroup/Project/indexes) block. */
const dbmlFold = foldService.of((state, lineStart, lineEnd) => {
  const header = state.doc.lineAt(lineStart).text;
  if (!/^\s*(?:TableGroup|Table|Enum|Project|indexes)\b[^{]*\{\s*(?:\/\/.*)?$/.test(header)) {
    return null;
  }

  let depth = 0;
  for (let n = state.doc.lineAt(lineStart).number; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    for (const ch of line.text) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0 && n > state.doc.lineAt(lineStart).number) {
          return { from: lineEnd, to: line.from };
        }
      }
    }
  }
  return null;
});

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

// ─── Theme ────────────────────────────────────────────────────────────────────

const dbmlHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--xd-accent-soft)', fontWeight: '600' },
  { tag: tags.typeName, color: '#67e8f9' },
  { tag: tags.propertyName, color: '#e2e8f0' },
  { tag: tags.labelName, color: '#c4b5fd' },
  { tag: tags.variableName, color: '#cbd5e1' },
  { tag: tags.modifier, color: '#f9a8d4' },
  { tag: tags.string, color: '#86efac' },
  { tag: tags.number, color: '#fbbf24' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: [tags.brace, tags.bracket, tags.punctuation], color: '#94a3b8' },
  { tag: tags.operator, color: '#f0abfc' },
]);

const dbmlTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#e2e8f0',
      fontSize: '13px',
      height: '100%',
    },
    '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '8px 0' },
    '.cm-scroller': { lineHeight: '1.625rem', fontFamily: 'inherit' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--xd-accent-soft)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--xd-accent) 35%, transparent)',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
    '.cm-gutters': {
      backgroundColor: 'rgba(2,6,23,0.5)',
      color: '#64748b',
      border: 'none',
      borderRight: '1px solid rgba(51,65,85,0.6)',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 6px', minWidth: '32px' },
    '.cm-foldGutter .cm-gutterElement': { color: '#64748b', cursor: 'pointer', padding: '0 2px' },
    '.cm-foldGutter .cm-gutterElement:hover': { color: 'var(--xd-accent-soft)' },
    '.cm-foldPlaceholder': {
      backgroundColor: 'color-mix(in srgb, var(--xd-accent) 25%, transparent)',
      border: 'none',
      color: '#e2e8f0',
      padding: '0 4px',
      margin: '0 2px',
      borderRadius: '3px',
    },
    '.cm-error-line': { backgroundColor: 'rgba(127,29,29,0.35)' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true },
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditorPanel({ value, onChange, error, onLoadSample }: EditorPanelProps) {
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
          dbmlLanguage,
          dbmlFold,
          syntaxHighlighting(dbmlHighlight),
          errorLineField,
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          keymap.of([...foldKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
          dbmlTheme,
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once: subsequent text changes are pushed in through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the document in sync when the parent replaces the text wholesale
  // (Load Sample, or a parse fallback). Skips echo from our own onChange.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(error?.line ?? null) });
  }, [error]);

  const runFoldCommand = (command: typeof foldAll) => {
    const view = viewRef.current;
    if (view) command(view);
  };

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{ background: 'var(--xd-surface)', borderColor: 'var(--xd-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--xd-border)' }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <FileCode2 size={14} style={{ color: 'var(--xd-accent-soft)' }} />
          DBML Editor
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => runFoldCommand(foldAll)}
            title="Fold all tables"
            aria-label="Fold all tables"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ChevronsDownUp size={14} />
          </button>
          <button
            onClick={() => runFoldCommand(unfoldAll)}
            title="Unfold all"
            aria-label="Unfold all"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ChevronsUpDown size={14} />
          </button>
          <button
            onClick={onLoadSample}
            className="ml-1 text-xs px-2 py-1 rounded text-white transition-opacity hover:opacity-90"
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
        <div className="flex items-start gap-2 px-3 py-2 border-t border-red-800/50 bg-red-950/40 shrink-0 text-xs text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400" />
          <span className="font-mono break-all">{error.message}</span>
        </div>
      )}
    </div>
  );
}
