'use client';

import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';

export interface RetrievedChunk {
  chunk_id: string;
  doc_name: string;
  page_number: number;
  text: string;
  similarity_score: number | null;
  bm25_score: number | null;
}

interface ChunkDebugPanelProps {
  chunks: RetrievedChunk[];
}

export default function ChunkDebugPanel({ chunks }: ChunkDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!chunks || chunks.length === 0) return null;

  return (
    <div className="mt-4 border-2 border-riso-ink bg-riso-gray/40">
      {/* Header Toggle Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-riso-ink text-riso-paper flex items-center justify-between text-xs font-bold uppercase tracking-wider transition-colors hover:bg-riso-pink"
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} />
          <span>Retrieval Debugger ({chunks.length} Chunks)</span>
        </div>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="p-3 bg-riso-gray riso-border-t overflow-hidden max-h-[500px] overflow-y-auto">
          <div className="space-y-4">
            {chunks.map((chunk, index) => (
              <div
                key={chunk.chunk_id}
                className="bg-riso-paper border border-riso-ink p-3 shadow-riso-sm relative animate-pop-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Ribbon Tag */}
                <div className="absolute top-0 right-0 bg-riso-ink text-riso-paper px-2 py-0.5 text-[9px] font-bold uppercase">
                  RANK #{index + 1}
                </div>

                {/* Metadata Row */}
                <div className="flex flex-wrap gap-2 text-[10px] font-bold text-riso-ink uppercase mb-2 mr-12">
                  <span className="bg-riso-blue text-riso-paper px-1.5 py-0.5">
                    FILE: {chunk.doc_name}
                  </span>
                  <span className="bg-riso-yellow text-riso-ink px-1.5 py-0.5 border border-riso-ink">
                    PG: {chunk.page_number}
                  </span>
                  {chunk.similarity_score !== null && (
                    <span className="bg-riso-teal text-riso-paper px-1.5 py-0.5">
                      COSINE: {chunk.similarity_score.toFixed(3)}
                    </span>
                  )}
                  {chunk.bm25_score !== null && (
                    <span className="bg-riso-pink text-riso-paper px-1.5 py-0.5">
                      BM25: {chunk.bm25_score.toFixed(3)}
                    </span>
                  )}
                </div>

                {/* Raw Chunk Content */}
                <div className="bg-riso-gray/50 border border-dashed border-riso-ink p-2 text-xxs font-mono text-riso-ink leading-relaxed break-words whitespace-pre-wrap">
                  {chunk.text}
                </div>
                
                {/* Chunk ID stamp */}
                <div className="mt-1.5 text-right text-[8px] text-riso-ink/40 font-mono">
                  ID: {chunk.chunk_id}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
