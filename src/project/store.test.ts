import { beforeEach, describe, expect, it } from 'vitest';
import {
  PROJECT_STORAGE_KEY,
  createDocument,
  documentName,
  loadProject,
  parseProject,
  saveProject,
  serializeProject,
  type Project,
} from './store';

describe('project store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds one ERD document when storage is empty', () => {
    const project = loadProject();
    expect(project.documents).toHaveLength(1);
    expect(project.documents[0].kind).toBe('erd');
    expect(project.activeId).toBe(project.documents[0].id);
  });

  it('round-trips through localStorage', () => {
    const project = loadProject();
    const seq = createDocument('sequence', project.documents);
    const next: Project = { documents: [...project.documents, seq], activeId: seq.id };
    saveProject(next);
    expect(loadProject()).toEqual(next);
  });

  it('survives corrupt storage by reseeding', () => {
    localStorage.setItem(PROJECT_STORAGE_KEY, '{not json');
    expect(loadProject().documents).toHaveLength(1);
  });

  it('names new documents by extension and avoids collisions', () => {
    const project = loadProject();
    expect(documentName('mindmap', project.documents)).toBe('untitled.mind');
    const first = createDocument('mindmap', project.documents);
    expect(documentName('mindmap', [first])).toBe('untitled-2.mind');
  });

  it('rejects a project with an unknown kind', () => {
    expect(() =>
      parseProject({ documents: [{ id: 'a', name: 'a.seq', kind: 'gantt', source: '' }] }),
    ).toThrowError(/unknown kind "gantt"/);
  });

  it('falls back to the first document when activeId is stale', () => {
    const project = parseProject({ documents: [{ id: 'a', name: 'a.dbml', kind: 'erd', source: '' }], activeId: 'gone' });
    expect(project.activeId).toBe('a');
  });

  it('imports a serialized project unchanged', () => {
    const project = loadProject();
    expect(parseProject(JSON.parse(serializeProject(project)))).toEqual(project);
  });
});
