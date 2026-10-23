import { describe, expect, it } from 'vitest';
import { parseFlowchart } from './parse';

describe('parseFlowchart', () => {
  it('reads direction and node shapes', () => {
    const model = parseFlowchart(`flowchart TB
  a[Rect]
  b(Round)
  c{Diamond}
  d((Circle))
`);
    expect(model.direction).toBe('TB');
    expect(model.nodes.map(n => [n.id, n.label, n.shape])).toEqual([
      ['a', 'Rect', 'rect'],
      ['b', 'Round', 'round'],
      ['c', 'Diamond', 'diamond'],
      ['d', 'Circle', 'circle'],
    ]);
  });

  it('parses chains, edge labels and styles', () => {
    const model = parseFlowchart(`graph LR
  a --> b --> c
  a -.-> d
  b ==> e
  d -->|yes| f
  e -- retry --> g
`);
    expect(model.edges.map(e => [e.from, e.to, e.label, e.dashed, e.thick, e.arrow])).toEqual([
      ['a', 'b', '', false, false, true],
      ['b', 'c', '', false, false, true],
      ['a', 'd', '', true, false, true],
      ['b', 'e', '', false, true, true],
      ['d', 'f', 'yes', false, false, true],
      ['e', 'g', 'retry', false, false, true],
    ]);
  });

  it('keeps a node declared once even when repeated', () => {
    const model = parseFlowchart(`flowchart LR
  a[Start] --> b[End]
  a --> c
`);
    expect(model.nodes.map(n => n.id)).toEqual(['a', 'b', 'c']);
    expect(model.nodes[0].label).toBe('Start');
  });

  it('ignores subgraph scaffolding', () => {
    const model = parseFlowchart(`flowchart LR
  subgraph group
  a --> b
  end
`);
    expect(model.nodes).toHaveLength(2);
    expect(model.edges).toHaveLength(1);
  });

  it('rejects a source without a header', () => {
    expect(() => parseFlowchart('a --> b')).toThrowError(/Flowcharts must start/);
  });

  it('reports the line of a malformed statement', () => {
    expect(() => parseFlowchart(`flowchart LR
  a --> b
  ????
`)).toThrowError(/Unrecognised flowchart statement/);
  });
});
