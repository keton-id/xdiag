/**
 * samples.ts
 * Starter source for each diagram kind, used when a document of that kind is
 * created without pasted text.
 */

export const SAMPLE_SEQUENCE = `sequenceDiagram
  actor User
  participant UI as xdiag UI
  participant Parser
  participant Canvas

  User->>UI: paste DBML
  UI->>Parser: parse(source)
  activate Parser
  Parser-->>UI: schema
  deactivate Parser
  UI->>Canvas: layout(schema)

  alt parse ok
    Canvas-->>User: ERD rendered
  else parse failed
    UI-->>User: error banner
  end

  loop each keystroke
    UI->>Parser: parse(source)
    Parser-->>UI: schema
  end
`;

export const SAMPLE_FLOWCHART = `flowchart LR
  paste[Paste text] --> parse{Parse}
  parse -->|ok| layout[Layout]
  parse -->|error| banner[Show error]
  layout --> render((Render SVG))
  banner -.-> paste
  render --> export[Export]
`;

export const SAMPLE_MINDMAP = `mindmap
  root((xdiag))
    Editor
      CodeMirror
      DBML highlighting
    Canvas
      React Flow
      dagre layout
    Export
      DBML
      SQL
`;
