/**
 * GroupNode.tsx
 * Custom ReactFlow node rendering a TableGroup boundary with dashed border.
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GroupNodeData } from '../../engine/layout';

function GroupNode({ data }: NodeProps) {
  const { group } = data as unknown as GroupNodeData;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        border: '2px dashed',
        borderColor: group.color ?? 'var(--xd-accent)',
        background: `color-mix(in srgb, ${group.color ?? 'var(--xd-accent)'} 6%, transparent)`,
        position: 'relative',
        pointerEvents: 'none',
      }}
    >
      <span
        className="absolute top-2 left-3 text-xs font-semibold tracking-wide uppercase"
        style={{ color: group.color ?? 'var(--xd-accent-soft)', opacity: 0.85 }}
      >
        {group.name}
      </span>
    </div>
  );
}

export default memo(GroupNode);
