# xdiag

A browser-only tool that turns text diagram descriptions into rendered, editable diagrams.
It owns no data: documents live in the browser and leave only through an explicit export.

## Language

**Diagram kind**:
The family a document belongs to, which decides how its source text is parsed and drawn —
an ERD and a sequence diagram are different kinds.
_Avoid_: Diagram type, mode, view

**Document**:
One source text plus the diagram kind it is written in. The unit the editor edits and the
canvas draws.

**Project**:
The ordered list of documents plus which one is active. One project per browser, persisted
under `localStorage['xdiag_project']` and moved in or out as `xdiag-project.json`.
_Avoid_: Workspace, session

**Schema**:
The in-memory model of tables, fields, relations, enums and table groups produced by parsing
DBML. Exists only for the ERD kind.

**Table**:
A schema-qualified relation with a name, fields, and an optional note or header colour.

**Field**:
A column of a table: name, type, key/unique/null/increment flags, optional default and note.

**Relation**:
A directed link between two fields, carrying cardinality and an optional constraint name.

**Cardinality**:
How many rows on each side of a relation may participate — one or many. Conveyed on the
canvas only by the crow's-foot end markers.
_Avoid_: Multiplicity, arity

**TableGroup**:
A named, dashed boundary drawn around a set of tables.

**DBML**:
The text format the ERD kind parses and exports.

**Canvas**:
The pan/zoom surface that draws the current document's diagram.
_Avoid_: Graph, stage

**Sample**:
The starter source for a kind — the 22-table e-commerce DBML schema for ERD, a short
Mermaid-compatible document for the others.

**Sequence diagram**:
A kind whose source is `sequenceDiagram`: participants, ordered messages, notes, and
nestable `loop`/`alt`/`opt` blocks. Drawn as lifelines with activation bars.
_Avoid_: Interaction diagram

**Participant**:
A lane in a sequence diagram — a boxed name with a vertical lifeline. Created explicitly
with `participant`/`actor` or implicitly by the first message that mentions it.

**Message**:
One arrow between two participants, carrying dashed/solid style, an arrow head, and an
optional activation change on the receiver.

**Flowchart**:
A kind whose source is `flowchart <direction>`: nodes with shapes (`[rect]`, `(round)`,
`{diamond}`, `((circle))`) joined by directed edges, optionally labelled.

**Mindmap**:
A kind whose source is `mindmap`: a single root whose children come from indentation.

**Direction**:
The flow of a laid-out diagram — `LR`, `TB`, `RL` or `BT` on the canvas, narrowed to
`LR`/`TB` for the ERD's dagre layout.

**Last good document**:
The most recent parse of the active document that produced no error. A broken edit renders
this instead of a blank canvas, with the error shown in the editor bar.
