# xdiag

A browser-only tool that turns a text diagram description into a rendered, editable
diagram. It owns no data: schemas live in the browser and leave only through an explicit
export.

## Language

**Diagram kind**:
The family a document belongs to, which decides how its source text is parsed and drawn —
an ERD and a sequence diagram are different kinds.
_Avoid_: Diagram type, mode, view

**Document**:
One source text plus the diagram kind it is written in. The unit the editor edits and the
canvas draws.

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
The built-in 22-table e-commerce DBML schema used to demonstrate the tool.
