/**
 * languages.ts
 * CodeMirror syntax for every diagram kind. DBML gets a stateful tokenizer
 * (blocks, settings brackets, PK/FK modifiers); the Mermaid-compatible kinds
 * share a line-oriented tokenizer with per-kind keywords and folding.
 */

import { EditorView } from '@codemirror/view';
import { HighlightStyle, StreamLanguage, foldService, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';

import type { DiagramKind } from '../../kinds/types';

// ─── DBML ─────────────────────────────────────────────────────────────────────

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
    if (first) {
      state.lineFirst = false;
      state.expectType = false;
    }

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

// ─── Mermaid-compatible kinds ────────────────────────────────────────────────

interface DiagramState {
  blockComment: boolean;
}

function wordSet(words: string[]): Record<string, true> {
  const out: Record<string, true> = {};
  for (const w of words) out[w] = true;
  return out;
}

const SEQUENCE_KEYWORDS = wordSet([
  'sequenceDiagram', 'participant', 'actor', 'as', 'Note', 'over', 'left', 'right', 'of',
  'loop', 'alt', 'opt', 'par', 'critical', 'break', 'rect', 'else', 'and', 'end',
  'autonumber', 'activate', 'deactivate',
]);

const FLOWCHART_KEYWORDS = wordSet([
  'flowchart', 'graph', 'subgraph', 'end', 'style', 'classDef', 'class', 'linkStyle',
  'LR', 'RL', 'TB', 'BT',
]);

const MINDMAP_KEYWORDS = wordSet(['mindmap']);

const ARROW_RE = /^(?:-->>|->>|-->|->|--x|-x|--\)|-\)|==>|-.->|---|==|--)/;
const WORD_RE = /^[A-Za-z_][\w$]*/;

function defineDiagramLanguage(name: string, keywords: Record<string, true>) {
  return StreamLanguage.define<DiagramState>({
    name,
    startState: () => ({ blockComment: false }),
    token(stream) {
      if (stream.eatSpace()) return null;

      if (stream.match('%%')) {
        stream.skipToEnd();
        return 'comment';
      }

      if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^'(?:[^'\\]|\\.)*'?/)) {
        return 'string';
      }

      if (stream.match(ARROW_RE)) return 'operator';
      if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';
      if (stream.match(/^[{}[\]()]/)) return 'bracket';
      if (stream.match(/^[,:;|]/)) return 'punctuation';

      const word = stream.match(WORD_RE) as RegExpMatchArray | null;
      if (word) return keywords[word[0]] ? 'keyword' : 'variableName';

      stream.next();
      return null;
    },
    languageData: { commentTokens: { line: '%%' } },
    tokenTable: {
      keyword: tags.keyword,
      string: tags.string,
      number: tags.number,
      comment: tags.comment,
      bracket: tags.bracket,
      punctuation: tags.punctuation,
      operator: tags.operator,
      variableName: tags.variableName,
    },
  });
}

const sequenceLanguage = defineDiagramLanguage('sequence', SEQUENCE_KEYWORDS);
const flowchartLanguage = defineDiagramLanguage('flowchart', FLOWCHART_KEYWORDS);
const mindmapLanguage = defineDiagramLanguage('mindmap', MINDMAP_KEYWORDS);

const SEQUENCE_BLOCK = /^\s*(?:loop|alt|opt|par|critical|break|rect)\b/;
const SUBGRAPH_BLOCK = /^\s*subgraph\b/;

/** Folds from an opener line to its matching `end` line. */
const blockFold = (opener: RegExp) =>
  foldService.of((state, lineStart, lineEnd) => {
    if (!opener.test(state.doc.lineAt(lineStart).text)) return null;
    const start = state.doc.lineAt(lineStart).number;
    for (let n = start + 1; n <= state.doc.lines; n++) {
      if (state.doc.line(n).text.trim() === 'end') {
        return { from: lineEnd, to: state.doc.line(n).to };
      }
    }
    return null;
  });

// ─── Shared theme ────────────────────────────────────────────────────────────

export const diagramHighlight = HighlightStyle.define([
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

export const diagramTheme = EditorView.theme(
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

export const highlightExtension = syntaxHighlighting(diagramHighlight);

/** Language plus the fold service for one kind. */
export function languageExtension(kind: DiagramKind): Extension {
  switch (kind) {
    case 'erd':
      return [dbmlLanguage, dbmlFold];
    case 'sequence':
      return [sequenceLanguage, blockFold(SEQUENCE_BLOCK)];
    case 'flowchart':
      return [flowchartLanguage, blockFold(SUBGRAPH_BLOCK)];
    case 'mindmap':
      return mindmapLanguage;
  }
}
