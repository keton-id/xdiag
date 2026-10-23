/**
 * store.ts
 * Project = an ordered list of documents plus the active one. Persisted in
 * localStorage and importable/exportable as a single JSON file.
 */

import { SAMPLE_DBML } from '../engine/sampleSchema';
import { KINDS } from '../kinds/registry';
import { DIAGRAM_KINDS, type DiagramKind } from '../kinds/types';

export const PROJECT_STORAGE_KEY = 'xdiag_project';

export interface ProjectDocument {
  id: string;
  name: string;
  kind: DiagramKind;
  source: string;
}

export interface Project {
  documents: ProjectDocument[];
  activeId: string;
}

const EXTENSIONS: Record<DiagramKind, string> = {
  erd: 'dbml',
  sequence: 'seq',
  flowchart: 'flow',
  mindmap: 'mind',
};

let counter = 0;

function newId(): string {
  counter += 1;
  return `doc_${Date.now().toString(36)}_${counter}`;
}

export function documentName(kind: DiagramKind, documents: ProjectDocument[]): string {
  const base = `untitled.${EXTENSIONS[kind]}`;
  if (!documents.some(d => d.name === base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `untitled-${n}.${EXTENSIONS[kind]}`;
    if (!documents.some(d => d.name === candidate)) return candidate;
  }
}

export function createDocument(kind: DiagramKind, documents: ProjectDocument[]): ProjectDocument {
  return { id: newId(), name: documentName(kind, documents), kind, source: KINDS[kind].sample };
}

function seed(): Project {
  const doc: ProjectDocument = { id: newId(), name: 'schema.dbml', kind: 'erd', source: SAMPLE_DBML };
  return { documents: [doc], activeId: doc.id };
}

function isKind(value: unknown): value is DiagramKind {
  return typeof value === 'string' && (DIAGRAM_KINDS as readonly string[]).includes(value);
}

/** Structural validation; throws a user-facing message on bad input. */
export function parseProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object' || !('documents' in raw) || !Array.isArray(raw.documents)) {
    throw new Error('Project JSON must contain a "documents" array');
  }
  if (raw.documents.length === 0) throw new Error('Project JSON has no documents');

  const documents: ProjectDocument[] = raw.documents.map((entry, i) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Document ${i + 1} is not an object`);
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id) throw new Error(`Document ${i + 1} needs an id`);
    if (typeof record.name !== 'string' || !record.name) throw new Error(`Document ${i + 1} needs a name`);
    if (typeof record.source !== 'string') throw new Error(`Document ${i + 1} needs source text`);
    if (!isKind(record.kind)) {
      throw new Error(`Document ${i + 1} has unknown kind "${String(record.kind)}"`);
    }
    return { id: record.id, name: record.name, kind: record.kind, source: record.source };
  });

  const activeId = 'activeId' in raw && typeof raw.activeId === 'string' ? raw.activeId : '';
  const active = documents.find(d => d.id === activeId) ?? documents[0];
  return { documents, activeId: active.id };
}

export function loadProject(): Project {
  try {
    const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (stored) return parseProject(JSON.parse(stored));
  } catch {
    // Corrupt or unavailable storage: fall through to the seeded project.
  }
  return seed();
}

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  } catch {
    // ignore storage quota errors
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}
