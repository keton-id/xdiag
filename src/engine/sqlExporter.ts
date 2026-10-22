/**
 * sqlExporter.ts
 * Exports a normalized Schema to PostgreSQL or MySQL DDL.
 */

import type { Schema, Table, Field, Relation, EnumDef } from '../types/schema';

export type SQLDialect = 'postgresql' | 'mysql';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function q(identifier: string, dialect: SQLDialect): string {
  return dialect === 'postgresql' ? `"${identifier}"` : `\`${identifier}\``;
}

function mapType(field: Field, dialect: SQLDialect): string {
  const t = field.type.toLowerCase();

  if (field.increment) {
    if (dialect === 'postgresql') {
      if (t.startsWith('big')) return 'BIGSERIAL';
      if (t.startsWith('small')) return 'SMALLSERIAL';
      return 'SERIAL';
    }
    // MySQL
    const base = t.startsWith('big') ? 'BIGINT' : t.startsWith('small') ? 'SMALLINT' : 'INT';
    return base; // AUTO_INCREMENT added in constraints section
  }

  // Normalize common aliases
  const map: Record<string, Record<SQLDialect, string>> = {
    bool:        { postgresql: 'BOOLEAN',   mysql: 'TINYINT(1)' },
    boolean:     { postgresql: 'BOOLEAN',   mysql: 'TINYINT(1)' },
    string:      { postgresql: 'TEXT',      mysql: 'TEXT' },
    int:         { postgresql: 'INTEGER',   mysql: 'INT' },
    integer:     { postgresql: 'INTEGER',   mysql: 'INT' },
    bigint:      { postgresql: 'BIGINT',    mysql: 'BIGINT' },
    smallint:    { postgresql: 'SMALLINT',  mysql: 'SMALLINT' },
    tinyint:     { postgresql: 'SMALLINT',  mysql: 'TINYINT' },
    float:       { postgresql: 'REAL',      mysql: 'FLOAT' },
    double:      { postgresql: 'DOUBLE PRECISION', mysql: 'DOUBLE' },
    real:        { postgresql: 'REAL',      mysql: 'FLOAT' },
    serial:      { postgresql: 'SERIAL',    mysql: 'INT' },
    bigserial:   { postgresql: 'BIGSERIAL', mysql: 'BIGINT' },
    text:        { postgresql: 'TEXT',      mysql: 'TEXT' },
    uuid:        { postgresql: 'UUID',      mysql: 'CHAR(36)' },
    json:        { postgresql: 'JSON',      mysql: 'JSON' },
    jsonb:       { postgresql: 'JSONB',     mysql: 'JSON' },
    blob:        { postgresql: 'BYTEA',     mysql: 'BLOB' },
    bytea:       { postgresql: 'BYTEA',     mysql: 'BLOB' },
    date:        { postgresql: 'DATE',      mysql: 'DATE' },
    time:        { postgresql: 'TIME',      mysql: 'TIME' },
    datetime:    { postgresql: 'TIMESTAMP', mysql: 'DATETIME' },
    timestamp:   { postgresql: 'TIMESTAMP', mysql: 'TIMESTAMP' },
    timestamptz: { postgresql: 'TIMESTAMPTZ', mysql: 'TIMESTAMP' },
  };

  // Strip type params for lookup (e.g. "varchar(255)" → "varchar")
  const base = t.replace(/\(.*\)/, '').trim();
  if (base in map) return map[base][dialect];

  // Preserve parameterized types like varchar(255), decimal(10,2)
  return field.type.toUpperCase();
}

function fieldDefault(field: Field): string {
  if (field.default === undefined) return '';
  // expression default e.g. (now())
  if (field.default.startsWith('(') && field.default.endsWith(')')) {
    const expr = field.default.slice(1, -1);
    return ` DEFAULT ${expr}`;
  }
  return ` DEFAULT ${field.default}`;
}

function renderField(field: Field, dialect: SQLDialect): string {
  const parts: string[] = [];
  parts.push(`  ${q(field.name, dialect)} ${mapType(field, dialect)}`);
  if (field.notNull || field.primaryKey) parts.push('NOT NULL');
  if (field.unique && !field.primaryKey) parts.push('UNIQUE');
  if (field.increment && dialect === 'mysql') parts.push('AUTO_INCREMENT');
  const def = fieldDefault(field);
  if (def) parts.push(def.trimStart());
  return parts.join(' ');
}

// ─── Enum export (PostgreSQL only) ────────────────────────────────────────────

function exportEnum(enumDef: EnumDef, dialect: SQLDialect): string {
  if (dialect === 'mysql') return ''; // MySQL uses ENUM() inline
  const values = enumDef.values.map((v) => `  '${v.name}'`).join(',\n');
  return `CREATE TYPE ${q(enumDef.name, dialect)} AS ENUM (\n${values}\n);\n`;
}

// ─── Table export ─────────────────────────────────────────────────────────────

function exportTable(table: Table, dialect: SQLDialect): string {
  const lines: string[] = [];
  const cols = table.fields.map((f) => renderField(f, dialect));
  const pkFields = table.fields.filter((f) => f.primaryKey);

  if (pkFields.length > 0) {
    const pkCols = pkFields.map((f) => q(f.name, dialect)).join(', ');
    cols.push(`  PRIMARY KEY (${pkCols})`);
  }

  lines.push(`CREATE TABLE ${q(table.name, dialect)} (`);
  lines.push(cols.join(',\n'));
  lines.push(');');

  // PostgreSQL: COMMENT ON TABLE / COLUMN
  if (dialect === 'postgresql') {
    if (table.note) {
      lines.push(`COMMENT ON TABLE ${q(table.name, dialect)} IS '${table.note.replace(/'/g, "''")}';`);
    }
    for (const field of table.fields) {
      if (field.note) {
        lines.push(
          `COMMENT ON COLUMN ${q(table.name, dialect)}.${q(field.name, dialect)} IS '${field.note.replace(/'/g, "''")}';`,
        );
      }
    }
  }

  return lines.join('\n');
}

// ─── Foreign Key export ────────────────────────────────────────────────────────

function constraintName(rel: Relation): string {
  return rel.name ?? `fk_${rel.from.tableId}_${rel.from.fieldName}`;
}

function exportForeignKey(rel: Relation, dialect: SQLDialect): string {
  // Skip N:M (junction table handles it)
  if (rel.cardinality === 'N:M') return '';

  // Determine which side holds the FK
  // N:1 → from side is many, holds FK; 1:N → to side is many, holds FK; 1:1 → from holds FK
  const fkTable = rel.cardinality === '1:N' ? rel.to : rel.from;
  const refTable = rel.cardinality === '1:N' ? rel.from : rel.to;

  const parts = [
    `ALTER TABLE ${q(fkTable.tableId, dialect)}`,
    `  ADD CONSTRAINT ${q(constraintName(rel), dialect)}`,
    `  FOREIGN KEY (${q(fkTable.fieldName, dialect)})`,
    `  REFERENCES ${q(refTable.tableId, dialect)} (${q(refTable.fieldName, dialect)})`,
  ];
  if (rel.onDelete) parts.push(`  ON DELETE ${rel.onDelete.toUpperCase()}`);
  if (rel.onUpdate) parts.push(`  ON UPDATE ${rel.onUpdate.toUpperCase()}`);
  return parts.join('\n') + ';';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SQLExportResult {
  ddl: string;
  dialect: SQLDialect;
}

/**
 * Export a Schema to SQL DDL for the given dialect.
 */
export function exportSQL(schema: Schema, dialect: SQLDialect): SQLExportResult {
  const sections: string[] = [];

  const header =
    dialect === 'postgresql'
      ? '-- PostgreSQL DDL generated by xdiag\n'
      : '-- MySQL DDL generated by xdiag\n';
  sections.push(header);

  // Enums (PostgreSQL only)
  const enumDDL = schema.enums.map((e) => exportEnum(e, dialect)).filter(Boolean);
  if (enumDDL.length > 0) {
    sections.push('-- Enums\n' + enumDDL.join('\n'));
  }

  // Tables
  const tableDDL = schema.tables.map((t) => exportTable(t, dialect));
  if (tableDDL.length > 0) {
    sections.push('-- Tables\n' + tableDDL.join('\n\n'));
  }

  // Foreign keys
  const fkDDL = schema.relations.map((r) => exportForeignKey(r, dialect)).filter(Boolean);
  if (fkDDL.length > 0) {
    sections.push('-- Foreign Keys\n' + fkDDL.join('\n\n'));
  }

  return { ddl: sections.join('\n\n'), dialect };
}
