import { describe, expect, it } from 'vitest';
import { parseDBML, preprocessDBML } from './dbmlParser';
import { operatorToCardinality } from '../types/schema';
import type { ParseResult, Schema } from '../types/schema';

const FULL = `

Project demo {
  database_type: 'PostgreSQL'
  Note: 'demo project'
}

Enum status {
  active
  inactive [note: 'not used']
}

Table users [headercolor: #ff0000] {
  id int [pk, increment]
  email varchar(255) [not null, unique]
  status status [default: 'active']
  created_at timestamp [default: \`now()\`]
  Note: 'app users'
}

Table posts {
  id int [pk]
  user_id int [not null, ref: > users.id]
  title text
  indexes {
    (id, title) [pk]
  }
}

Ref: posts.user_id > users.id [delete: cascade]

TableGroup core {
  users
  posts
}
`;

function expectSchema(result: ParseResult): Schema {
  if (!result.ok) throw new Error(`expected success, got: ${result.error}`);
  return result.schema;
}

describe('parseDBML', () => {
  it('returns an empty schema for blank input', () => {
    const result = parseDBML('   \n\t ');
    expect(result).toEqual({
      ok: true,
      schema: { tables: [], relations: [], enums: [], tableGroups: [] },
      warnings: [],
    });
  });

  it('parses project, tables, fields and settings', () => {
    const schema = expectSchema(parseDBML(FULL));

    expect(schema.projectName).toBe('demo');
    expect(schema.note).toBe('demo project');

    const users = schema.tables.find(t => t.id === 'users');
    expect(users).toMatchObject({ name: 'users', note: 'app users', headerColor: '#FF0000' });
    expect(users?.fields.map(f => f.id)).toEqual([
      'users.id',
      'users.email',
      'users.status',
      'users.created_at',
    ]);

    const byName = Object.fromEntries(users!.fields.map(f => [f.name, f]));
    expect(byName.id).toMatchObject({ type: 'int', primaryKey: true, increment: true, notNull: false });
    expect(byName.email).toMatchObject({ type: 'varchar(255)', notNull: true, unique: true });
    expect(byName.status.default).toBe("'active'");
    expect(byName.created_at.default).toBe('(now())');
  });

  it('applies composite primary keys from an indexes block', () => {
    const schema = expectSchema(parseDBML(FULL));
    const posts = schema.tables.find(t => t.id === 'posts')!;
    const pk = posts.fields.filter(f => f.primaryKey).map(f => f.name);
    expect(pk).toEqual(['id', 'title']);
  });

  it('keeps a single relation for an inline ref plus its standalone declaration', () => {
    const schema = expectSchema(parseDBML(FULL));
    expect(schema.relations).toHaveLength(1);
    expect(schema.relations[0]).toMatchObject({
      cardinality: '1:N',
      from: { tableId: 'users', fieldId: 'users.id', fieldName: 'id' },
      to: { tableId: 'posts', fieldId: 'posts.user_id', fieldName: 'user_id' },
    });
  });

  it('carries ref actions when the relation is declared only as a standalone Ref', () => {
    const schema = expectSchema(
      parseDBML(
        'Table a {\n id int [pk]\n}\nTable b {\n a_id int\n}\n' +
          'Ref: b.a_id > a.id [delete: cascade, update: restrict]',
      ),
    );
    expect(schema.relations[0]).toMatchObject({
      cardinality: 'N:1',
      onDelete: 'cascade',
      onUpdate: 'restrict',
    });
  });

  it('parses enums and table groups', () => {
    const schema = expectSchema(parseDBML(FULL));
    expect(schema.enums).toEqual([
      {
        id: 'status',
        name: 'status',
        values: [{ name: 'active' }, { name: 'inactive', note: 'not used' }],
      },
    ]);
    expect(schema.tableGroups).toEqual([
      { id: 'core', name: 'core', tableIds: ['users', 'posts'] },
    ]);
  });

  it('qualifies ids for schema-scoped tables', () => {
    const schema = expectSchema(parseDBML('Table auth.users {\n  id int [pk]\n}'));
    expect(schema.tables[0]).toMatchObject({ id: 'auth.users', name: 'users', schema: 'auth' });
    expect(schema.tables[0].fields[0].id).toBe('auth.users.id');
  });

  it('reports a syntax error with line and column', () => {
    const result = parseDBML('Table {');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('DBML parse error');
    expect(result.line).toBe(1);
    expect(result.column).toBe(7);
    expect(result.partial).toBeUndefined();
  });

  it('returns a partial schema from the fallback parser on error', () => {
    const result = parseDBML('Table x {\n  id int\n  oops !!!\n}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.partial?.tables.map(t => t.id)).toEqual(['x']);
    expect(result.partial?.tables[0].fields.map(f => f.name)).toEqual(['id']);
  });

  it('never throws on hostile input', () => {
    for (const input of ['}}}', 'Ref: a.b >', '\u0000', 'Table t { a b c d e }']) {
      expect(() => parseDBML(input)).not.toThrow();
    }
  });
});

describe('preprocessDBML', () => {
  it('normalizes CRLF and CR line endings', () => {
    expect(preprocessDBML('Table a {\r\n  id int\r}')).toBe('Table a {\n  id int\n}');
  });

  it('inserts the missing space before braces and settings brackets', () => {
    const out = preprocessDBML('Table users{\n  id int[pk]\n}');
    expect(out).toContain('Table users {');
    expect(out).toContain('id int [pk]');
  });

  it('drops trailing commas inside settings', () => {
    expect(preprocessDBML('Table a {\n  id int [pk, not null,]\n}')).toContain('[pk, not null]');
  });

  it('splits inline field declarations onto their own lines', () => {
    const out = preprocessDBML('Table a { id int [pk] name text }');
    expect(out.split('\n').map(l => l.trim()).filter(Boolean)).toEqual([
      'Table a {',
      'id int [pk]',
      'name text',
      '}',
    ]);
  });

  it('leaves string literals untouched', () => {
    const out = preprocessDBML("Table a {\n  note varchar [default: 'a,b]']\n}");
    expect(out).toContain("'a,b]'");
  });

  it('returns an empty string for empty input', () => {
    expect(preprocessDBML('')).toBe('');
  });
});

describe('operatorToCardinality', () => {
  it('maps every DBML ref operator', () => {
    expect(operatorToCardinality('-')).toBe('1:1');
    expect(operatorToCardinality('<')).toBe('1:N');
    expect(operatorToCardinality('>')).toBe('N:1');
    expect(operatorToCardinality('<>')).toBe('N:M');
  });
});
