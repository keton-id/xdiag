import { describe, expect, it } from 'vitest';
import { parseMindmap } from './parse';

describe('parseMindmap', () => {
  it('builds a tree from indentation', () => {
    const model = parseMindmap(`mindmap
  root((xdiag))
    Editor
      CodeMirror
    Canvas
    Export
`);
    expect(model.root?.label).toBe('xdiag');
    expect(model.root?.shape).toBe('circle');
    expect(model.root?.children.map(c => c.label)).toEqual(['Editor', 'Canvas', 'Export']);
    expect(model.root?.children[0].children.map(c => c.label)).toEqual(['CodeMirror']);
  });

  it('supports the mermaid shape brackets', () => {
    const model = parseMindmap(`mindmap
  root
    a[rect]
    b(round)
    c))bang((
    d)cloud(
`);
    expect(model.root?.children.map(c => c.shape)).toEqual(['rect', 'rounded', 'bang', 'cloud']);
  });

  it('treats tabs and uneven indentation as depth changes', () => {
    const model = parseMindmap(`mindmap
  root
      deep
       deeper
    shallow
`);
    const children = model.root?.children ?? [];
    expect(children.map(c => c.label)).toEqual(['deep', 'shallow']);
    expect(children[0].children.map(c => c.label)).toEqual(['deeper']);
  });

  it('rejects a second root', () => {
    expect(() => parseMindmap(`mindmap
  root
other
`)).toThrowError(/one root/);
  });

  it('rejects a missing header', () => {
    expect(() => parseMindmap('root')).toThrowError(/mindmap/);
  });
});
