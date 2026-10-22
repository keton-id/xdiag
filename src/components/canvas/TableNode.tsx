/**
 * TableNode.tsx
 * Custom ReactFlow node rendering a DB table card styled like dbdiagram.io.
 * Field rows expose left/right Handles for relation connections.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Key } from 'lucide-react';
import type { TableNodeData } from '../../engine/layout';
import type { Field } from '../../types/schema';
import { useHoveredField, useSetHoveredField } from './fieldHover';

// ─── Sub-components ───────────────────────────────────────────────────────────
// Handles are invisible until the row is hovered; both sides sit on the row's
// horizontal centre line.
const HANDLE_STYLE = {
  top: '50%',
  width: 8,
  height: 8,
  background: 'var(--xd-accent)',
  border: '1.5px solid var(--xd-accent-soft)',
  borderRadius: '50%',
  opacity: 0,
} as const;

function PkBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-400/20 text-amber-300 border border-amber-400/30">
      <Key size={8} />
      PK
    </span>
  );
}

function FkBadge() {
  return (
    <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-sky-400/20 text-sky-300 border border-sky-400/30">
      FK
    </span>
  );
}

interface FieldRowProps {
  field: Field;
  tableId: string;
  isFk: boolean;
}

const FieldRow = memo(function FieldRow({ field, tableId, isFk }: FieldRowProps) {
  const handleId = `${tableId}.${field.name}`;
  const setHoveredField = useSetHoveredField();
  const isHovered = useHoveredField() === field.id;

  // Only relation participants are hoverable: plain columns would otherwise
  // dim every edge in the canvas.
  const hoverProps = isFk
    ? {
        onMouseEnter: () => setHoveredField(field.id),
        onMouseLeave: () => setHoveredField(null),
      }
    : {};

  return (
    <div
      data-field-id={field.id}
      data-relation-field={isFk ? '' : undefined}
      {...hoverProps}
      className={`relative flex items-center gap-1.5 px-3 h-7 border-t border-white/5 group transition-colors ${
        isHovered ? 'bg-indigo-500/20' : 'hover:bg-white/5'
      }`}
    >
      {/* Both sides expose a source and a target handle so relations can
          attach to whichever side ends up nearest the other table. */}
      <Handle
        id={`${handleId}__left-target`}
        type="target"
        position={Position.Left}
        style={HANDLE_STYLE}
        className="group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        id={`${handleId}__left-source`}
        type="source"
        position={Position.Left}
        style={HANDLE_STYLE}
        className="group-hover:!opacity-100 transition-opacity"
      />

      {/* Field name */}
      <span
        className={`flex-1 truncate text-xs ${field.primaryKey ? 'font-semibold text-white' : 'text-gray-300'}`}
      >
        {field.name}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1 shrink-0">
        {field.primaryKey && <PkBadge />}
        {isFk && !field.primaryKey && <FkBadge />}
      </div>

      {/* Type */}
      <span className="text-[10px] text-gray-500 shrink-0 max-w-[72px] truncate font-mono">
        {field.type}
      </span>

      <Handle
        id={`${handleId}__right-source`}
        type="source"
        position={Position.Right}
        style={HANDLE_STYLE}
        className="group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        id={`${handleId}__right-target`}
        type="target"
        position={Position.Right}
        style={HANDLE_STYLE}
        className="group-hover:!opacity-100 transition-opacity"
      />
    </div>
  );
});

// ─── TableNode ────────────────────────────────────────────────────────────────

function TableNode({ data, selected }: NodeProps) {
  const { table, schema } = data as unknown as TableNodeData;

  // Collect field IDs that are FK endpoints
  const fkFieldIds = new Set<string>();
  for (const rel of schema.relations) {
    if (rel.from.tableId === table.id) fkFieldIds.add(rel.from.fieldId);
    if (rel.to.tableId === table.id) fkFieldIds.add(rel.to.fieldId);
  }

  const headerBg = table.headerColor ?? 'var(--xd-accent)';

  return (
    <div
      className="rounded-lg overflow-hidden shadow-xl border border-white/10 transition-all"
      style={{
        minWidth: 200,
        background: 'var(--xd-surface-alt)',
        ...(selected
          ? {
              borderColor: 'var(--xd-accent-soft)',
              boxShadow: '0 0 0 1px var(--xd-accent-soft), 0 12px 32px -12px var(--xd-accent)',
            }
          : null),
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 h-9 gap-2"
        style={{ background: headerBg }}
      >
        <span className="font-semibold text-sm text-white truncate">{table.name}</span>
        {table.schema && (
          <span className="text-[10px] text-white/60 shrink-0">{table.schema}</span>
        )}
      </div>

      {/* Fields */}
      {table.fields.map(field => (
        <FieldRow
          key={field.id}
          field={field}
          tableId={table.id}
          isFk={fkFieldIds.has(field.id)}
        />
      ))}
    </div>
  );
}

export default memo(TableNode);
