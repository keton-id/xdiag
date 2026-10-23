# Multi-format project model

xdiag started as a single DBML document. It now holds a *project*: an ordered list of
documents, each with its own kind (ERD, sequence, flowchart, mindmap). The alternative —
one document per browser tab, or one kind per install — was rejected because the point of
the file list is to keep related diagrams (a schema and the flow that explains it) in one
place with one export.

Kinds are declared in a single `Record<DiagramKind, KindSpec>` (`src/kinds/registry.ts`):
icon, labels, sample, toolbar actions, and parser. Adding kind #5 is one entry, and
forgetting one is a compile error rather than a blank canvas.

The spec is deliberately **not** generic over its model type. A generic
`KindSpec<M>` forced every call site through a type parameter it could not infer, because
`parse(source, previous?)` has to accept a document of any kind and narrow on
`previous.kind` at runtime. Runtime narrowing plus exhaustive `record.kind === …` checks
buys the same safety with far less ceremony.

## Considered options

**Embed Mermaid** instead of hand-writing three renderers. Rejected: mermaid 12.2.0 is
~1.6 MB gzipped for the core plus a 208 kB sequence chunk, and pulls 23 transitive
dependencies, against a stated goal of a fast local-first tool. The supported grammar is a
Mermaid-compatible subset, so sources remain portable to Mermaid; `par`, `critical`, `box`
and actor groups are out of scope.

## Consequences

Non-ERD renderers are `lazy()`-loaded. The ERD entry chunk must not grow when a renderer is
added — the sequence, flowchart and mindmap canvases land in their own chunks, each a few
kilobytes.

Every `parse` is total: a broken source returns the last good model plus an `error`, so a
mid-edit typo shows an error bar over the previous drawing instead of blanking the canvas.
