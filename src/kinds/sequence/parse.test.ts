import { describe, expect, it } from 'vitest';
import { parseSequence } from './parse';
import type { SequenceBlock, SequenceMessage, SequenceNote } from '../types';

const blocks = (source: string) =>
  parseSequence(source).steps.filter((s): s is SequenceBlock => s.t === 'block');
const messages = (source: string) =>
  parseSequence(source).steps.filter((s): s is SequenceMessage => s.t === 'message');

describe('parseSequence', () => {
  it('declares participants from `participant`/`actor` lines with aliases', () => {
    const model = parseSequence(`sequenceDiagram
  participant A as Alice
  actor B
  A->>B: hi
`);
    expect(model.participants).toEqual([
      { id: 'A', label: 'Alice', actor: false },
      { id: 'B', label: 'B', actor: true },
    ]);
  });

  it('creates participants implicitly on first mention', () => {
    const model = parseSequence(`sequenceDiagram
  API->>DB: query
`);
    expect(model.participants.map(p => p.id)).toEqual(['API', 'DB']);
  });

  it('maps arrow styles to dash, head and activation flags', () => {
    const model = parseSequence(`sequenceDiagram
  A->>B: solid
  A-->>B: dashed
  A->>+B: activate
  B-->>-A: deactivate
  A-xB: cross
  A-)B: async
`);
    const msgs = messages(`sequenceDiagram
  A->>B: solid
  A-->>B: dashed
  A->>+B: activate
  B-->>-A: deactivate
  A-xB: cross
  A-)B: async
`);
    expect(model.steps).toHaveLength(6);
    expect(msgs.map(m => [m.dashed, m.head, m.activate, m.deactivate])).toEqual([
      [false, 'filled', false, false],
      [true, 'filled', false, false],
      [false, 'filled', true, false],
      [true, 'filled', false, true],
      [false, 'cross', false, false],
      [false, 'open', false, false],
    ]);
  });

  it('records notes with placement and targets', () => {
    const model = parseSequence(`sequenceDiagram
  participant A
  participant B
  Note over A,B: shared note
  Note right of A: side note
`);
    const notes = model.steps.filter((s): s is SequenceNote => s.t === 'note');
    expect(notes.map(n => [n.placement, n.ids, n.text])).toEqual([
      ['over', ['A', 'B'], 'shared note'],
      ['right', ['A'], 'side note'],
    ]);
  });

  it('emits start/divider/end steps for blocks', () => {
    const source = `sequenceDiagram
  A->>B: go
  alt ok
    A->>B: yes
  else failed
    A->>B: no
  end
`;
    expect(blocks(source).map(b => [b.action, b.tag, b.label])).toEqual([
      ['start', 'alt', 'ok'],
      ['divider', 'else', 'failed'],
      ['end', '', ''],
    ]);
  });

  it('skips comments and autonumber', () => {
    const model = parseSequence(`sequenceDiagram
  %% a comment
  autonumber
  A->>B: hi
`);
    expect(model.steps).toHaveLength(1);
  });

  it('reports a missing header with line 1', () => {
    expect(() => parseSequence('A->>B: hi')).toThrowError(/sequenceDiagram/);
  });

  it('reports an unclosed block at the opening line', () => {
    expect(() => parseSequence(`sequenceDiagram
  A->>B: hi
  loop forever
    A->>B: ping
`)).toThrowError(/missing "end"/);
  });
});
