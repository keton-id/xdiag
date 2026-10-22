/**
 * ExportModal.tsx
 * Modal for exporting the diagram as DBML, PostgreSQL, MySQL, or JSON.
 */

import { useState } from 'react';
import { X, Copy, Check, Download } from 'lucide-react';
import type { Schema } from '../../types/schema';
import { exportSQL } from '../../engine/sqlExporter';

type ExportFormat = 'dbml' | 'postgresql' | 'mysql' | 'json';

interface ExportModalProps {
  schema: Schema;
  dbmlSource: string;
  onClose: () => void;
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  dbml: 'DBML',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  json: 'JSON',
};

function buildOutput(format: ExportFormat, schema: Schema, dbmlSource: string): string {
  switch (format) {
    case 'dbml': return dbmlSource;
    case 'postgresql': return exportSQL(schema, 'postgresql').ddl;
    case 'mysql': return exportSQL(schema, 'mysql').ddl;
    case 'json': return JSON.stringify(schema, null, 2);
  }
}

export default function ExportModal({ schema, dbmlSource, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('dbml');
  const [copied, setCopied] = useState(false);

  const output = buildOutput(format, schema, dbmlSource);

  function handleCopy() {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => undefined);
  }

  function handleDownload() {
    const ext: Record<ExportFormat, string> = { dbml: 'dbml', postgresql: 'sql', mysql: 'sql', json: 'json' };
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema.${ext[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Export Schema</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Format tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                format === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Content */}
        <pre className="flex-1 overflow-auto mx-5 mt-3 p-3 rounded-lg bg-slate-950 border border-slate-700 text-[12px] font-mono text-gray-300 leading-relaxed whitespace-pre">
          {output}
        </pre>

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-700">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm text-white transition-colors"
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
