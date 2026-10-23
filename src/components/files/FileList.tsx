/**
 * FileList.tsx
 * Project documents at the top of the editor pane. Each row is a document;
 * the icon identifies the diagram kind. Add, rename (double-click, Enter to
 * commit, Escape to cancel) and delete live here.
 */

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { KINDS } from '../../kinds/registry';
import { DIAGRAM_KINDS } from '../../kinds/types';
import type { DiagramKind } from '../../kinds/types';
import type { ProjectDocument } from '../../project/store';

interface FileListProps {
  documents: ProjectDocument[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: (kind: DiagramKind) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function KindIcon({ kind, size = 13 }: { kind: DiagramKind; size?: number }) {
  const Icon = KINDS[kind].icon;
  return <Icon size={size} className="shrink-0" aria-hidden />;
}

export default function FileList({
  documents,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: FileListProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const addRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  useEffect(() => {
    if (!adding) return;
    const onDown = (e: PointerEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAdding(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [adding]);

  function beginRename(doc: ProjectDocument) {
    setEditingId(doc.id);
    setDraft(doc.name);
  }

  function commitRename() {
    if (editingId) {
      const name = draft.trim();
      if (name) onRename(editingId, name);
    }
    setEditingId(null);
  }

  return (
    <div className="shrink-0 border-b" style={{ borderColor: 'var(--xd-border)' }}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Files <span className="text-slate-600">({documents.length})</span>
        </span>
        <div className="relative" ref={addRef}>
          <button
            type="button"
            onClick={() => setAdding(v => !v)}
            title="Add file"
            aria-label="Add file"
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <Plus size={14} />
          </button>
          {adding && (
            <div
              className="absolute right-0 top-7 z-30 w-44 overflow-hidden rounded-lg border shadow-xl"
              style={{ background: 'var(--xd-surface-alt)', borderColor: 'var(--xd-border)' }}
            >
              {DIAGRAM_KINDS.map(kind => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    onAdd(kind);
                    setAdding(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <KindIcon kind={kind} />
                  {KINDS[kind].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className="max-h-40 overflow-y-auto pb-1">
        {documents.map(doc => {
          const active = doc.id === activeId;
          return (
            <li key={doc.id} className="group/row flex items-center gap-1 px-1">
              <button
                type="button"
                onClick={() => onSelect(doc.id)}
                onDoubleClick={() => beginRename(doc)}
                title={`${doc.name} — ${KINDS[doc.kind].label}`}
                data-testid="file-row"
                data-kind={doc.kind}
                data-active={active ? 'true' : 'false'}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                  active ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
                style={active ? { background: 'color-mix(in srgb, var(--xd-accent) 22%, transparent)' } : undefined}
              >
                <span style={{ color: active ? 'var(--xd-accent-soft)' : undefined }}>
                  <KindIcon kind={doc.kind} />
                </span>
                {editingId === doc.id ? (
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    aria-label="File name"
                    className="min-w-0 flex-1 rounded border px-1 py-0 text-xs text-white outline-none"
                    style={{ background: 'var(--xd-bg)', borderColor: 'var(--xd-accent)' }}
                  />
                ) : (
                  <span className="truncate font-mono">{doc.name}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onDelete(doc.id)}
                title="Delete file"
                aria-label={`Delete ${doc.name}`}
                disabled={documents.length === 1}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 opacity-0 transition-all hover:bg-red-500/15 hover:text-red-400 disabled:pointer-events-none group-hover/row:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
