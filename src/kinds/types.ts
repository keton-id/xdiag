/**
 * types.ts
 * Domain types for the four diagram kinds. A Document is one source text plus
 * the kind it is written in; parsing a Document yields a KindDocument, which is
 * what a canvas renders.
 */

import type { Schema } from '../types/schema';

export type DiagramKind = 'erd' | 'sequence' | 'flowchart' | 'mindmap';

export const DIAGRAM_KINDS: readonly DiagramKind[] = ['erd', 'sequence', 'flowchart', 'mindmap'];

/** A source-level failure, with the 1-based line when the parser knows it. */
export interface DiagramError {
  message: string;
  line?: number;
}

export class DiagramParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'DiagramParseError';
    this.line = line;
  }
}

// ─── Sequence ────────────────────────────────────────────────────────────────

export interface SequenceParticipant {
  id: string;
  label: string;
  actor: boolean;
}

export interface SequenceMessage {
  t: 'message';
  from: string;
  to: string;
  text: string;
  dashed: boolean;
  head: 'filled' | 'open' | 'cross';
  activate: boolean;
  deactivate: boolean;
}

export interface SequenceNote {
  t: 'note';
  placement: 'over' | 'left' | 'right';
  ids: string[];
  text: string;
}

export interface SequenceBlock {
  t: 'block';
  action: 'start' | 'divider' | 'end';
  /** `loop`, `alt`, `opt`, `par`, …; `else`/`and` on dividers. */
  tag: string;
  label: string;
}

export interface SequenceActivation {
  t: 'activation';
  id: string;
  on: boolean;
}

export type SequenceStep = SequenceMessage | SequenceNote | SequenceBlock | SequenceActivation;

export interface SequenceModel {
  participants: SequenceParticipant[];
  steps: SequenceStep[];
}

// ─── Flowchart ───────────────────────────────────────────────────────────────

export type FlowShape = 'rect' | 'round' | 'diamond' | 'circle';

export interface FlowNode {
  id: string;
  label: string;
  shape: FlowShape;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
  dashed: boolean;
  thick: boolean;
  arrow: boolean;
}

export type FlowDirection = 'LR' | 'TB' | 'RL' | 'BT';

export interface FlowModel {
  direction: FlowDirection;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ─── Mindmap ─────────────────────────────────────────────────────────────────

export type MindShape = 'rounded' | 'rect' | 'circle' | 'bang' | 'cloud';

export interface MindNode {
  id: string;
  label: string;
  shape: MindShape;
  children: MindNode[];
}

export interface MindModel {
  root: MindNode | null;
}

// ─── Parsed documents ────────────────────────────────────────────────────────

export interface ERDDocument {
  kind: 'erd';
  error: DiagramError | null;
  schema: Schema;
}

export interface SequenceDocument {
  kind: 'sequence';
  error: DiagramError | null;
  model: SequenceModel;
}

export interface FlowchartDocument {
  kind: 'flowchart';
  error: DiagramError | null;
  model: FlowModel;
}

export interface MindmapDocument {
  kind: 'mindmap';
  error: DiagramError | null;
  model: MindModel;
}

export type KindDocument =
  | ERDDocument
  | SequenceDocument
  | FlowchartDocument
  | MindmapDocument;

/** Narrowing helper: the error carried by any document kind. */
export function documentError(doc: KindDocument): DiagramError | null {
  return doc.error;
}
