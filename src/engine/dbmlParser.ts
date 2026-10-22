/**
 * dbmlParser.ts
 * Parses DBML text into our normalized Schema model using @dbml/core.
 * Resilient: collects warnings, provides partial results on error.
 */

import { Parser } from '@dbml/core';
import type {
  Schema,
  Table,
  Field,
  Relation,
  EnumDef,
  TableGroup,
  RelationCardinality,
  ParseResult,
} from '../types/schema';

// ─── @dbml/core raw shapes (internal, not exported by the lib) ────────────────

interface RawFieldType {
  type_name: string;
  args?: string | null;
  schemaName?: string | null;
}

interface RawDefault {
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean' | 'expression';
}

interface RawInlineRef {
  tableName: string;
  fieldNames: string[];
  relation: string;
  schemaName?: string | null;
}

interface RawField {
  name: string;
  type: RawFieldType;
  pk?: boolean;
  unique?: boolean;
  not_null?: boolean;
  increment?: boolean;
  dbdefault?: RawDefault;
  note?: { value: string };
  inline_refs?: RawInlineRef[];
}

interface RawIndexColumn {
  value: string;
  type?: string;
}

interface RawIndex {
  columns?: (RawIndexColumn | string)[];
  pk?: boolean;
  unique?: boolean;
  name?: string;
  type?: string;
}

interface RawTable {
  name: string;
  schemaName?: string | null;
  alias?: string | null;
  note?: { value: string } | null;
  fields?: RawField[];
  headerColor?: string;
  indexes?: RawIndex[];
}

interface RawEndpoint {
  tableName: string;
  fieldNames: string[];
  relation: string; // '1' | '*'
  schemaName?: string | null;
}

interface RawRef {
  name?: string | null;
  endpoints: RawEndpoint[];
  onDelete?: string | null;
  onUpdate?: string | null;
}

interface RawEnumValue {
  name: string;
  note?: { value: string };
}

interface RawEnum {
  name: string;
  schemaName?: string | null;
  values: RawEnumValue[];
}

interface RawTableGroup {
  name: string;
  tables: Array<{ name: string; schemaName?: string | null }>;
}

interface RawDBML {
  tables: RawTable[];
  refs: RawRef[];
  enums: RawEnum[];
  tableGroups: RawTableGroup[];
  project?: { name?: string; note?: { value: string } };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tableId(schemaName: string | null | undefined, name: string): string {
  return schemaName ? `${schemaName}.${name}` : name;
}

function fieldId(tId: string, fieldName: string): string {
  return `${tId}.${fieldName}`;
}

let _relationCounter = 0;
function nextRelationId(): string {
  return `rel_${++_relationCounter}`;
}

/** Maps raw endpoint relation strings ('1' | '*') to cardinality. */
function endpointsToCardinality(ep0: RawEndpoint, ep1: RawEndpoint): RelationCardinality {
  const r0 = ep0.relation;
  const r1 = ep1.relation;
  if (r0 === '1' && r1 === '1') return '1:1';
  if (r0 === '1' && r1 === '*') return '1:N';
  if (r0 === '*' && r1 === '1') return 'N:1';
  return 'N:M';
}

function normalizeAction(
  raw: string | null | undefined,
): Relation['onDelete'] {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim() as Relation['onDelete'];
  return lower;
}

function formatDefault(d: RawDefault | undefined): string | undefined {
  if (!d) return undefined;
  if (d.type === 'expression') return `(${d.value})`;
  if (d.type === 'string') return `'${d.value}'`;
  return String(d.value);
}

// ─── Transformer ─────────────────────────────────────────────────────────────

function transformTable(raw: RawTable, warnings: string[]): Table {
  const tId = tableId(raw.schemaName, raw.name);

  // Detect composite primary keys defined in table indexes
  const indexPkColumns = new Set<string>();
  for (const idx of raw.indexes ?? []) {
    if (idx.pk) {
      for (const col of idx.columns ?? []) {
        const colName = typeof col === 'string' ? col : col?.value;
        if (colName) indexPkColumns.add(colName);
      }
    }
  }

  const fields: Field[] = (raw.fields ?? []).map((f) => {
    if (!f.name) warnings.push(`Table "${raw.name}": field with no name skipped`);
    const isPk = Boolean(f.pk) || indexPkColumns.has(f.name);
    return {
      id: fieldId(tId, f.name),
      name: f.name,
      type: f.type?.type_name ?? 'unknown',
      primaryKey: isPk,
      unique: f.unique ?? false,
      notNull: f.not_null ?? false,
      increment: f.increment ?? false,
      default: formatDefault(f.dbdefault),
      note: f.note?.value,
    } satisfies Field;
  });
  return {
    id: tId,
    name: raw.name,
    schema: raw.schemaName ?? undefined,
    alias: raw.alias ?? undefined,
    note: raw.note?.value,
    headerColor: raw.headerColor,
    fields,
  };
}

function transformRef(
  raw: RawRef,
  tableMap: Map<string, Table>,
  warnings: string[],
): Relation | null {
  if ((raw.endpoints?.length ?? 0) < 2) {
    warnings.push(`Ref "${raw.name ?? '?'}": fewer than 2 endpoints, skipped`);
    return null;
  }
  const ep0 = raw.endpoints[0];
  const ep1 = raw.endpoints[1];

  const t0Id = tableId(ep0.schemaName, ep0.tableName);
  const t1Id = tableId(ep1.schemaName, ep1.tableName);

  if (!tableMap.has(t0Id)) {
    warnings.push(`Ref "${raw.name ?? '?'}": table "${t0Id}" not found`);
    return null;
  }
  if (!tableMap.has(t1Id)) {
    warnings.push(`Ref "${raw.name ?? '?'}": table "${t1Id}" not found`);
    return null;
  }

  const fn0 = ep0.fieldNames[0] ?? '';
  const fn1 = ep1.fieldNames[0] ?? '';

  return {
    id: nextRelationId(),
    name: raw.name ?? undefined,
    cardinality: endpointsToCardinality(ep0, ep1),
    from: { tableId: t0Id, fieldId: fieldId(t0Id, fn0), fieldName: fn0 },
    to: { tableId: t1Id, fieldId: fieldId(t1Id, fn1), fieldName: fn1 },
    onDelete: normalizeAction(raw.onDelete),
    onUpdate: normalizeAction(raw.onUpdate),
  };
}

function transformEnum(raw: RawEnum): EnumDef {
  return {
    id: tableId(raw.schemaName, raw.name),
    name: raw.name,
    schema: raw.schemaName ?? undefined,
    values: (raw.values ?? []).map((v) => ({
      name: v.name,
      note: v.note?.value,
    })),
  };
}

function transformTableGroup(
  raw: RawTableGroup,
  tableMap: Map<string, Table>,
  warnings: string[],
): TableGroup {
  const tableIds: string[] = [];
  for (const t of raw.tables ?? []) {
    const tid = tableId(t.schemaName, t.name);
    if (!tableMap.has(tid)) {
      warnings.push(`TableGroup "${raw.name}": table "${tid}" not found`);
    } else {
      tableIds.push(tid);
    }
  }
  return {
    id: raw.name,
    name: raw.name,
    tableIds,
  };
}

/**
 * Also extract inline refs embedded inside field definitions (e.g. `[ref: > table.field]`).
 * These are NOT included in the top-level `refs` array by @dbml/core v10.
 */
function extractInlineRefs(
  rawTables: RawTable[],
  tableMap: Map<string, Table>,
  warnings: string[],
): Relation[] {
  const relations: Relation[] = [];
  for (const rawTable of rawTables) {
    const tId = tableId(rawTable.schemaName, rawTable.name);
    for (const rawField of rawTable.fields ?? []) {
      for (const inlineRef of rawField.inline_refs ?? []) {
        const targetTId = tableId(inlineRef.schemaName, inlineRef.tableName);
        const targetFieldName = inlineRef.fieldNames?.[0] ?? '';
        if (!tableMap.has(targetTId)) {
          warnings.push(`Inline ref from "${tId}.${rawField.name}": table "${targetTId}" not found`);
          continue;
        }
        let cardinality: RelationCardinality;
        // DBML inline ref operators: > means this.field > other.field (N:1), < means 1:N, - means 1:1, <> means N:M
        switch (inlineRef.relation) {
          case '>': cardinality = 'N:1'; break;
          case '<': cardinality = '1:N'; break;
          case '-': cardinality = '1:1'; break;
          case '<>': cardinality = 'N:M'; break;
          default: cardinality = 'N:1';
        }

        relations.push({
          id: nextRelationId(),
          cardinality,
          from: { tableId: tId, fieldId: fieldId(tId, rawField.name), fieldName: rawField.name },
          to: { tableId: targetTId, fieldId: fieldId(targetTId, targetFieldName), fieldName: targetFieldName },
        });
      }
    }
  }
  return relations;
}

// ─── Preprocessor & Fallback Parser ───────────────────────────────────────────

/**
 * Normalizes and repairs common DBML formatting errors:
 * - Normalizes Windows CRLF line endings.
 * - Fixes missing spaces before settings brackets: `varchar(255)[not null]` -> `varchar(255) [not null]`.
 * - Fixes missing spaces before table body braces: `Table users{` -> `Table users {`.
 * - Cleans trailing commas in bracket settings: `[pk, not null,]` -> `[pk, not null]`.
 * - Normalizes inline declarations on the same line to separate lines.
 */
export function preprocessDBML(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Protect string literals and notes from regex replacement
  const stringLiterals: string[] = [];
  const placeholder = (str: string) => {
    stringLiterals.push(str);
    return `___STR_LITERAL_${stringLiterals.length - 1}___`;
  };

  text = text.replace(/('''[\s\S]*?'''|"""[\s\S]*?"""|'[^'\n]*'|"[^"\n]*"|`[^`\n]*`)/g, placeholder);

  // Fix missing space before settings brackets
  text = text.replace(/([a-zA-Z0-9_)>\]])\[/g, '$1 [');
  // Fix missing space before table braces
  text = text.replace(/([a-zA-Z0-9_])\{/g, '$1 {');
  // Fix trailing commas in bracket settings
  text = text.replace(/,\s*\]/g, ']');
  // Ensure newline after opening brace if followed by inline content
  text = text.replace(/\{\s*([^\s\n])/g, '{\n  $1');
  // Ensure newline after bracket setting when followed by field name on same line
  text = text.replace(/\]\s*([a-zA-Z0-9_])/g, ']\n  $1');
  // Ensure closing brace is on its own line if preceded by content
  text = text.replace(/([^\s\n])\s*\}/g, '$1\n}');

  // Restore string literals
  text = text.replace(/___STR_LITERAL_(\d+)___/g, (_, idx) => stringLiterals[Number(idx)] ?? '');

  return text;
}

/**
 * Regex-based tolerant fallback parser extracting valid tables and references
 * when @dbml/core grammar parser encounters unrecoverable syntax errors.
 */
export function parseFallback(text: string): Schema {
  const tables: Table[] = [];
  const relations: Relation[] = [];
  const tableGroups: TableGroup[] = [];
  let relCounter = 0;

  // Extract Table blocks: Table [schema.]name [as alias] [header] { body }
  const tableBlockRegex =
    /Table\s+(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)(?:\s+as\s+([a-zA-Z0-9_]+))?(?:\s*\[([^\]]*)\])?\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = tableBlockRegex.exec(text)) !== null) {
    const [, schemaName, tableName, alias, headerColorRaw, body] = match;
    const tId = tableId(schemaName, tableName);

    let headerColor: string | undefined;
    if (headerColorRaw) {
      const colorMatch = headerColorRaw.match(/headercolor:\s*['"]?([#a-zA-Z0-9_-]+)['"]?/i);
      if (colorMatch) headerColor = colorMatch[1];
    }

    // Check indexes block for composite PKs
    const indexPkCols = new Set<string>();
    const indexesBlockMatch = body.match(/indexes\s*\{([\s\S]*?)\}/);
    if (indexesBlockMatch) {
      const idxBody = indexesBlockMatch[1];
      const idxLineRegex = /\(([^)]+)\)\s*\[[^\]]*\bpk\b[^\]]*\]/g;
      let idxMatch: RegExpExecArray | null;
      while ((idxMatch = idxLineRegex.exec(idxBody)) !== null) {
        idxMatch[1]
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
          .forEach((c) => indexPkCols.add(c));
      }
    }

    const fields: Field[] = [];
    const lines = body.split('\n');
    let hadUnparsedContent = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('Note:') || line.startsWith('indexes')) {
        continue;
      }
      if (line === '}' || line === '{') continue;

      const fieldMatch = line.match(
        /^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_(),\s]+?)(?:\s*\[([^\]]*)\])?(?:\s*\/\/[^\n]*)?$/,
      );
      if (!fieldMatch) {
        hadUnparsedContent = true;
        continue;
      }

      const [, fieldName, fieldType, settings = ''] = fieldMatch;
      if (fieldName === 'indexes' || fieldName === 'Note') continue;

      const pk = /\bpk\b|\bprimary\s+key\b/i.test(settings) || indexPkCols.has(fieldName);
      const unique = /\bunique\b/i.test(settings);
      const notNull = /\bnot\s+null\b/i.test(settings);
      const increment = /\bincrement\b/i.test(settings);

      // Default
      let defVal: string | undefined;
      const defMatch = settings.match(/\bdefault:\s*(`[^`]*`|'[^']*'|"[^"]*"|\S+)/i);
      if (defMatch) {
        defVal = defMatch[1].replace(/^[`'"]|[`'"]$/g, '');
      }

      // Note
      let noteVal: string | undefined;
      const noteMatch = settings.match(/\bnote:\s*('[^']*'|"[^"]*")/i);
      if (noteMatch) {
        noteVal = noteMatch[1].slice(1, -1);
      }

      // Inline ref
      const refMatch = settings.match(
        /\bref:\s*([><-])\s*(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/i,
      );
      if (refMatch) {
        const [, op, targetSchema, targetTable, targetField] = refMatch;
        const targetTId = tableId(targetSchema, targetTable);
        let card: RelationCardinality = '1:N';
        if (op === '-') card = '1:1';
        else if (op === '>') card = 'N:1';
        else if (op === '<') card = '1:N';

        relations.push({
          id: `fallback_rel_${++relCounter}`,
          cardinality: card,
          from: { tableId: tId, fieldId: fieldId(tId, fieldName), fieldName },
          to: { tableId: targetTId, fieldId: fieldId(targetTId, targetField), fieldName: targetField },
        });
      }

      fields.push({
        id: fieldId(tId, fieldName),
        name: fieldName,
        type: fieldType.trim(),
        primaryKey: pk,
        unique,
        notNull,
        increment,
        default: defVal,
        note: noteVal,
      });
    }

    // Skip tables whose body could not be parsed at all (the broken blocks)
    if (fields.length === 0 && hadUnparsedContent) continue;

    if (fields.length > 0 || tableName) {
      tables.push({
        id: tId,
        name: tableName,
        schema: schemaName || undefined,
        alias: alias || undefined,
        headerColor,
        fields,
      });
    }
  }

  // Standalone Refs
  const standaloneRefRegex =
    /Ref(?:\s+[a-zA-Z0-9_]+)?:\s*(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*([><-])\s*(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
  let sRefMatch: RegExpExecArray | null;
  while ((sRefMatch = standaloneRefRegex.exec(text)) !== null) {
    const [, s1, t1, f1, op, s2, t2, f2] = sRefMatch;
    const fromT = tableId(s1, t1);
    const toT = tableId(s2, t2);
    let card: RelationCardinality = '1:N';
    if (op === '-') card = '1:1';
    else if (op === '>') card = 'N:1';
    else if (op === '<') card = '1:N';

    relations.push({
      id: `fallback_rel_${++relCounter}`,
      cardinality: card,
      from: { tableId: fromT, fieldId: fieldId(fromT, f1), fieldName: f1 },
      to: { tableId: toT, fieldId: fieldId(toT, f2), fieldName: f2 },
    });
  }

  // TableGroups
  const tgRegex = /TableGroup\s+([a-zA-Z0-9_]+)\s*\{([^}]*)\}/g;
  let tgMatch: RegExpExecArray | null;
  while ((tgMatch = tgRegex.exec(text)) !== null) {
    const [, tgName, tgBody] = tgMatch;
    const tableIds = tgBody
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('//'));
    tableGroups.push({
      id: `tg_${tgName}`,
      name: tgName,
      tableIds,
    });
  }

  return {
    tables,
    relations,
    enums: [],
    tableGroups,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a DBML string into a normalized {@link Schema}.
 * Never throws: errors are captured in the returned {@link ParseResult}.
 * Employs preprocessor repairs and fallback partial parsing on error.
 */
export function parseDBML(dbmlText: string): ParseResult {
  _relationCounter = 0;
  const warnings: string[] = [];

  const trimmed = dbmlText.trim();
  if (!trimmed) {
    return {
      ok: true,
      schema: { tables: [], relations: [], enums: [], tableGroups: [] },
      warnings: [],
    };
  }

  const preprocessed = preprocessDBML(dbmlText);

  let raw: RawDBML;
  try {
    raw = Parser.parseDBMLToJSON(preprocessed) as unknown as RawDBML;
  } catch (err: unknown) {
    const errObj = err as {
      message?: string;
      location?: { start?: { line?: number; column?: number } };
    };
    const line = errObj.location?.start?.line;
    const column = errObj.location?.start?.column;
    const locStr = line ? ` (line ${line}${column ? `:${column}` : ''})` : '';
    const message = errObj.message ?? (err instanceof Error ? err.message : String(err));
    const errorMsg = `DBML parse error: ${message}${locStr}`;

    const fallbackSchema = parseFallback(preprocessed);
    if (fallbackSchema.tables.length > 0) {
      return {
        ok: false,
        error: errorMsg,
        line,
        column,
        partial: fallbackSchema,
        warnings,
      };
    }
    return { ok: false, error: errorMsg, line, column, warnings };
  }

  // Build tables
  const tables: Table[] = [];
  for (const rawTable of raw.tables ?? []) {
    try {
      tables.push(transformTable(rawTable, warnings));
    } catch (e) {
      warnings.push(`Failed to transform table "${rawTable.name}": ${e}`);
    }
  }

  const tableMap = new Map(tables.map((t) => [t.id, t]));

  // Build enums
  const enums: EnumDef[] = (raw.enums ?? []).map(transformEnum);

  // Build top-level refs and deduplicate relations
  const relations: Relation[] = [];
  const relSet = new Set<string>();

  for (const rawRef of raw.refs ?? []) {
    const rel = transformRef(rawRef, tableMap, warnings);
    if (rel) {
      const key = [rel.from.fieldId, rel.to.fieldId].sort().join('<->');
      if (!relSet.has(key)) {
        relSet.add(key);
        relations.push(rel);
      }
    }
  }

  // Extract inline refs (in case any were omitted in raw.refs)
  const inlineRels = extractInlineRefs(raw.tables ?? [], tableMap, warnings);
  for (const rel of inlineRels) {
    const key = [rel.from.fieldId, rel.to.fieldId].sort().join('<->');
    if (!relSet.has(key)) {
      relSet.add(key);
      relations.push(rel);
    }
  }
  // Build tableGroups
  const tableGroups: TableGroup[] = (raw.tableGroups ?? []).map((g) =>
    transformTableGroup(g, tableMap, warnings),
  );

  const schema: Schema = {
    projectName: raw.project?.name,
    note: raw.project?.note?.value,
    tables,
    relations,
    enums,
    tableGroups,
  };

  return { ok: true, schema, warnings };
}
