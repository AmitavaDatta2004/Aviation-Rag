'use client';

import React from 'react';
import { RefreshCw, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface StatusBadgeProps {
  indexLoaded: boolean;
  chunksCount: number;
  documents: string[];
  isIngesting: boolean;
  onIngest: () => void;
}

export default function StatusBadge({
  indexLoaded,
  chunksCount,
  documents,
  isIngesting,
  onIngest,
}: StatusBadgeProps) {
  return (
    <div className="bg-riso-gray riso-border p-4 shadow-riso relative mb-6">
      {/* Accent spot color decoration to mimic misregistration overlay */}
      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-riso-pink border border-riso-ink pointer-events-none" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-riso-ink mb-1 flex items-center gap-2">
            SYSTEM STATUS PANEL
          </h2>
          <div className="flex flex-wrap gap-2 items-center text-xs">
            {indexLoaded ? (
              <span className="bg-riso-teal text-riso-paper border border-riso-ink px-2 py-0.5 font-bold flex items-center gap-1 uppercase">
                <CheckCircle size={12} /> Index Ready
              </span>
            ) : (
              <span className="bg-riso-pink text-riso-paper border border-riso-ink px-2 py-0.5 font-bold flex items-center gap-1 uppercase">
                <AlertTriangle size={12} /> Index Missing
              </span>
            )}
            <span className="border border-riso-ink bg-riso-paper text-riso-ink px-2 py-0.5 font-bold">
              CHUNKS: {chunksCount}
            </span>
          </div>
        </div>

        <button
          onClick={onIngest}
          disabled={isIngesting}
          className={`w-full md:w-auto px-4 py-2 border-2 border-riso-ink font-bold text-xs uppercase transition-all flex items-center justify-center gap-2 ${
            isIngesting
              ? 'bg-riso-darkgray text-riso-ink cursor-not-allowed'
              : 'bg-riso-yellow text-riso-ink hover:bg-riso-pink hover:text-riso-paper shadow-riso-sm hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]'
          }`}
        >
          <RefreshCw size={14} className={isIngesting ? 'animate-spin' : ''} />
          {isIngesting ? 'Ingesting Chunks...' : 'Ingest PDF Documents'}
        </button>
      </div>

      {documents.length > 0 && (
        <div className="mt-4 pt-3 border-t border-dashed border-riso-ink">
          <h3 className="text-xxs font-bold uppercase tracking-wider text-riso-ink mb-2">
            INDEXED SOURCE FILES ({documents.length}):
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {documents.map((doc, idx) => (
              <li
                key={idx}
                className="bg-riso-paper border border-riso-ink px-2 py-1 flex items-center gap-1.5 text-xs overflow-hidden text-ellipsis whitespace-nowrap"
                title={doc}
              >
                <FileText size={12} className="text-riso-blue flex-shrink-0" />
                <span className="truncate">{doc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
