// ─── Primitive Field Types ────────────────────────────────────────────────────

export type FieldType =
  | 'int' | 'integer' | 'bigint' | 'smallint' | 'tinyint'
  | 'float' | 'double' | 'decimal' | 'numeric' | 'real'
  | 'boolean' | 'bool'
  | 'varchar' | 'char' | 'text' | 'string'
  | 'date' | 'time' | 'datetime' | 'timestamp' | 'timestamptz'
  | 'uuid' | 'json' | 'jsonb' | 'blob' | 'bytea'
  | 'serial' | 'bigserial' | 'enum'
  | string; // allow custom / parameterized types like varchar(255)

// ─── Field (Column) ───────────────────────────────────────────────────────────

export interface FieldNote {
  value: string;
}

export interface Field {
  id: string;          // unique: `${tableId}.${name}`
  name: string;
  type: FieldType;
  primaryKey: boolean;
  unique: boolean;
  notNull: boolean;
  increment: boolean;  // auto-increment / serial
  default?: string;    // raw default expression
  note?: string;       // column comment
  enumValues?: string[]; // when type === 'enum'
}

// ─── Table ────────────────────────────────────────────────────────────────────

export interface Table {
  id: string;          // normalized: schema.name or just name
  name: string;
  schema?: string;
  alias?: string;
  note?: string;
  headerColor?: string; // dbdiagram headercolor
  fields: Field[];
}

// ─── Relation Cardinality ─────────────────────────────────────────────────────

export type RelationCardinality = '1:1' | '1:N' | 'N:1' | 'N:M';

/**
 * Maps DBML ref operator strings to our cardinality enum.
 *   `-`  → 1:1
 *   `<`  → 1:N  (left side is "one", right side is "many")
 *   `>`  → N:1
 *   `<>` → N:M
 */
export type DBMLRefOperator = '-' | '<' | '>' | '<>';

export function operatorToCardinality(op: DBMLRefOperator): RelationCardinality {
  switch (op) {
    case '-':  return '1:1';
    case '<':  return '1:N';
    case '>':  return 'N:1';
    case '<>': return 'N:M';
  }
}

// ─── Relation (Foreign Key / Ref) ─────────────────────────────────────────────

export interface RelationEndpoint {
  tableId: string;
  fieldId: string;  // `${tableId}.${fieldName}`
  fieldName: string;
}

export interface Relation {
  id: string;                    // unique generated id
  cardinality: RelationCardinality;
  from: RelationEndpoint;
  to: RelationEndpoint;
  onDelete?: 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';
  onUpdate?: 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';
  name?: string;                 // constraint name from DBML
}

// ─── Enum Definition ──────────────────────────────────────────────────────────

export interface EnumValue {
  name: string;
  note?: string;
}

export interface EnumDef {
  id: string;
  name: string;
  schema?: string;
  values: EnumValue[];
}

// ─── TableGroup ───────────────────────────────────────────────────────────────

export interface TableGroup {
  id: string;
  name: string;
  tableIds: string[];   // ordered list of table ids in this group
  color?: string;
}

// ─── Normalized Schema (the parsed model) ────────────────────────────────────

export interface Schema {
  projectName?: string;
  note?: string;
  tables: Table[];
  relations: Relation[];
  enums: EnumDef[];
  tableGroups: TableGroup[];
}

// ─── ERD Graph (ReactFlow layer) ─────────────────────────────────────────────

export interface TableNodeData {
  table: Table;
  group?: TableGroup;
}

export interface RelationEdgeData {
  relation: Relation;
}

/** Node type discriminant used by ReactFlow node renderers. */
export type ERDNodeType = 'tableNode';
/** Edge type discriminant. */
export type ERDEdgeType = 'relationEdge';

// ─── Parse Result ─────────────────────────────────────────────────────────────

export interface ParseSuccess {
  ok: true;
  schema: Schema;
  warnings: string[];
}

export interface ParseFailure {
  ok: false;
  error: string;
  line?: number;
  column?: number;
  partial?: Schema;
  warnings: string[];
}

export type ParseResult = ParseSuccess | ParseFailure;
