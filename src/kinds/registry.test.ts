import { describe, expect, it } from 'vitest';
import { KINDS } from './registry';
import { DIAGRAM_KINDS } from './types';
import { SAMPLE_DBML } from '../engine/sampleSchema';

describe('kind registry', () => {
  it('declares every kind', () => {
    expect(Object.keys(KINDS).sort()).toEqual([...DIAGRAM_KINDS].sort());
  });

  it('parses each built-in sample without an error', () => {
    for (const kind of DIAGRAM_KINDS) {
      const doc = KINDS[kind].parse(KINDS[kind].sample);
      expect(doc.kind, kind).toBe(kind);
      expect(doc.error, `${kind} sample`).toBeNull();
    }
  });

  it('keeps the previous document when the new source does not parse', () => {
    const good = KINDS.sequence.parse(KINDS.sequence.sample);
    const bad = KINDS.sequence.parse('not a sequence', good);
    expect(bad.error?.message).toMatch(/sequenceDiagram/);
    expect(bad.kind).toBe('sequence');
    expect(good.kind).toBe('sequence');
    if (bad.kind !== 'sequence' || good.kind !== 'sequence') throw new Error('wrong kind');
    expect(bad.model).toBe(good.model);
  });

  it('marks the ERD parser error with the failing line', () => {
    const doc = KINDS.erd.parse(`Table a {\n  id int [pk]\n}\nTable b {\n  id int [pk]\n`);
    expect(doc.error?.line).toBeGreaterThan(1);
    expect(doc.kind === 'erd' && doc.schema.tables.map(t => t.name)).toEqual(['a']);
  });

  it('parses the ERD sample into a populated schema', () => {
    const doc = KINDS.erd.parse(SAMPLE_DBML);
    expect(doc.kind === 'erd' && doc.schema.tables.length).toBeGreaterThan(10);
  });

  it('declares which toolbar actions each kind supports', () => {
    expect(KINDS.erd.actions).toEqual(['arrange', 'direction', 'schemaExport']);
    for (const kind of DIAGRAM_KINDS.filter(k => k !== 'erd')) {
      expect(KINDS[kind].actions).toEqual([]);
    }
  });
});
