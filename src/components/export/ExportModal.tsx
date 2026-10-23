/**
 * ExportModal.tsx
 * Kind-aware export: ERD offers DBML/SQL/JSON, every kind offers its source
 * and, when a vector canvas is mounted, an SVG snapshot.
 */

import { useMemo, useState } from 'react';
import { X, Copy, Check, Download } from 'lucide-react';

import type { Schema } from '../../types/schema';
import type { DiagramKind } from '../../kinds/types';
import { KINDS } from '../../kinds/registry';
import { exportSQL } from '../../engine/sqlExporter';
import { canvasSvgMarkup, downloadText } from '../svg/exportSvg';

type ExportFormat = 'source' | 'dbml' | 'postgresql' | 'mysql' | 'json' | 'svg';

const FORMAT_LABELS: Record<ExportFormat, string> = {
  source: 'Source',
  dbml: 'DBML',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  json: 'JSON',
  svg: 'SVG',
};

const EXTENSIONS: Record<ExportFormat, string> = {
  source: 'txt',
  dbml: 'dbml',
  postgresql: 'sql',
  mysql: 'sql',
  json: 'json',
  svg: 'svg',
};

interface ExportModalProps {
  kind: DiagramKind;
  source: string;
  schema: Schema | null;
  onClose: () => void;
}

function formatsFor(kind: DiagramKind): ExportFormat[] {
  // ERD nodes are React Flow DOM, not SVG, so a vector snapshot only exists
  // for the hand-rolled canvases.
  return kind === 'erd' ? ['dbml', 'postgresql', 'mysql', 'json'] : ['source', 'svg'];
}

export default function ExportModal({ kind, source, schema, onClose }: ExportModalProps) {
  const formats = formatsFor(kind);
  const [format, setFormat] = useState<ExportFormat>(formats[0]);
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    switch (format) {
      case 'source':
      case 'dbml':
        return source;
      case 'postgresql':
        return schema ? exportSQL(schema, 'postgresql').ddl : '';
      case 'mysql':
        return schema ? exportSQL(schema, 'mysql').ddl : '';
      case 'json':
        return schema ? JSON.stringify(schema, null, 2) : '';
      case 'svg':
        return canvasSvgMarkup() ?? 'The current canvas does not expose a vector snapshot.';
    }
  }, [format, source, schema]);

  function handleCopy() {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => undefined);
  }

  function handleDownload() {
    const base = kind === 'erd' ? 'schema' : kind;
    const ext = EXTENSIONS[format];
    downloadText(output, `${base}.${ext}`, format === 'svg' ? 'image/svg+xml' : 'text/plain');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[85vh] w-[720px] max-w-[95vw] flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2 className="font-semibold text-white">Export {KINDS[kind].label}</h2>
          <button onClick={onClose} className="text-gray-400 transition-colors hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Format tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {formats.map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                format === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Content */}
        <pre className="mx-5 mt-3 flex-1 overflow-auto whitespace-pre rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-[12px] leading-relaxed text-gray-300">
          {output}
        </pre>

        {/* Actions */}
        <div className="flex gap-2 border-t border-slate-700 px-5 py-4">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded bg-slate-700 px-3 py-2 text-sm text-white transition-colors hover:bg-slate-600"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-500"
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
