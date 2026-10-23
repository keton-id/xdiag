/**
 * registry.ts
 * The single place a diagram kind is declared: icon, labels, starter source,
 * toolbar actions and parser. `Record<DiagramKind, KindSpec>` makes a missing
 * kind a compile error rather than a runtime surprise.
 */

import { BrainCircuit, Database, MessagesSquare, Workflow, type LucideIcon } from 'lucide-react';

import { parseDBML } from '../engine/dbmlParser';
import { SAMPLE_DBML } from '../engine/sampleSchema';
import type { Schema } from '../types/schema';
import { parseFlowchart } from './flowchart/parse';
import { parseMindmap } from './mindmap/parse';
import { parseSequence } from './sequence/parse';
import { SAMPLE_FLOWCHART, SAMPLE_MINDMAP, SAMPLE_SEQUENCE } from './samples';
import type { DiagramError, DiagramKind, FlowModel, KindDocument, MindModel, SequenceModel } from './types';

/** Toolbar affordances a kind opts into. */
export type KindAction = 'arrange' | 'direction' | 'schemaExport';

export interface KindSpec {
  icon: LucideIcon;
  label: string;
  /** Short noun for the editor header ("DBML", "Sequence", …). */
  language: string;
  sample: string;
  actions: readonly KindAction[];
  /** Never throws: a broken document returns the last good model plus an error. */
  parse(source: string, previous?: KindDocument): KindDocument;
}

const EMPTY_SCHEMA: Schema = { tables: [], relations: [], enums: [], tableGroups: [] };
const EMPTY_SEQUENCE: SequenceModel = { participants: [], steps: [] };
const EMPTY_FLOW: FlowModel = { direction: 'LR', nodes: [], edges: [] };
const EMPTY_MIND: MindModel = { root: null };

function messageOf(err: unknown): DiagramError {
  if (err instanceof Error && 'line' in err && typeof err.line === 'number') {
    return { message: err.message, line: err.line };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}

const erd: KindSpec = {
  icon: Database,
  label: 'ERD',
  language: 'DBML',
  sample: SAMPLE_DBML,
  actions: ['arrange', 'direction', 'schemaExport'],
  parse(source, previous) {
    const result = parseDBML(source);
    if (result.ok) return { kind: 'erd', error: null, schema: result.schema };

    const error: DiagramError = { message: result.error, line: result.line };
    if (result.partial && result.partial.tables.length > 0) {
      return { kind: 'erd', error, schema: result.partial };
    }
    const fallback = previous?.kind === 'erd' ? previous.schema : EMPTY_SCHEMA;
    return { kind: 'erd', error, schema: fallback };
  },
};

const sequence: KindSpec = {
  icon: MessagesSquare,
  label: 'Sequence',
  language: 'Sequence',
  sample: SAMPLE_SEQUENCE,
  actions: [],
  parse(source, previous) {
    try {
      return { kind: 'sequence', error: null, model: parseSequence(source) };
    } catch (err) {
      const model = previous?.kind === 'sequence' ? previous.model : EMPTY_SEQUENCE;
      return { kind: 'sequence', error: messageOf(err), model };
    }
  },
};

const flowchart: KindSpec = {
  icon: Workflow,
  label: 'Flowchart',
  language: 'Flowchart',
  sample: SAMPLE_FLOWCHART,
  actions: [],
  parse(source, previous) {
    try {
      return { kind: 'flowchart', error: null, model: parseFlowchart(source) };
    } catch (err) {
      const model = previous?.kind === 'flowchart' ? previous.model : EMPTY_FLOW;
      return { kind: 'flowchart', error: messageOf(err), model };
    }
  },
};

const mindmap: KindSpec = {
  icon: BrainCircuit,
  label: 'Mindmap',
  language: 'Mindmap',
  sample: SAMPLE_MINDMAP,
  actions: [],
  parse(source, previous) {
    try {
      return { kind: 'mindmap', error: null, model: parseMindmap(source) };
    } catch (err) {
      const model = previous?.kind === 'mindmap' ? previous.model : EMPTY_MIND;
      return { kind: 'mindmap', error: messageOf(err), model };
    }
  },
};

export const KINDS: Record<DiagramKind, KindSpec> = {
  erd,
  sequence,
  flowchart,
  mindmap,
};

export function kindSpec(kind: DiagramKind): KindSpec {
  return KINDS[kind];
}
