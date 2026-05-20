'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, FileText, CheckCircle, AlertTriangle, Loader, Zap } from 'lucide-react';

interface StatusBadgeProps {
  indexLoaded: boolean;
  chunksCount: number;
  documents: string[];
  isIngesting: boolean;
  onIngest: () => void;
  onIngestionComplete: () => void; // callback to refresh health after done
}

interface ProgressState {
  phase: string;
  current: number;
  total: number;
  message: string;
  error?: string;
  startedAt?: number;
}

const PHASE_LABELS: Record<string, string> = {
  idle:      'IDLE',
  parsing:   'PHASE 1/4 — PARSING PDFs',
  chunking:  'PHASE 2/4 — SPLITTING CHUNKS',
  embedding: 'PHASE 3/4 — LOCAL EMBEDDING',
  indexing:  'PHASE 4/4 — WRITING INDEXES',
  done:      'COMPLETE',
  error:     'ERROR',
};

export default function StatusBadge({
  indexLoaded,
  chunksCount,
  documents,
  isIngesting,
  onIngest,
  onIngestionComplete,
}: StatusBadgeProps) {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Start polling when ingestion begins
  useEffect(() => {
    if (isIngesting) {
      startTimeRef.current = Date.now();
      setElapsedSecs(0);

      // Poll progress endpoint every 1.5s
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/ingest/progress');
          if (res.ok) {
            const data: ProgressState = await res.json();
            setProgress(data);

            // Stop polling when done or error
            if (data.phase === 'done' || data.phase === 'error') {
              clearInterval(pollRef.current!);
              clearInterval(timerRef.current!);
              onIngestionComplete();
            }
          }
        } catch {}
      }, 1500);

      // Elapsed time counter
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } else {
      clearInterval(pollRef.current!);
      clearInterval(timerRef.current!);
    }

    return () => {
      clearInterval(pollRef.current!);
      clearInterval(timerRef.current!);
    };
  }, [isIngesting]);

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  const phaseLabel = progress ? (PHASE_LABELS[progress.phase] ?? progress.phase.toUpperCase()) : '';

  return (
    <div className="bg-riso-gray riso-border p-4 shadow-riso relative mb-6">
      {/* Misregistration accent dot */}
      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-riso-pink border border-riso-ink pointer-events-none" />

      <div className="flex flex-col gap-4">

        {/* Top row: status + button */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-riso-ink mb-1">
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
                CHUNKS: {isIngesting && progress ? progress.total || chunksCount : chunksCount}
              </span>
            </div>
          </div>

          <button
            onClick={onIngest}
            disabled={isIngesting}
            className={`w-full md:w-auto px-4 py-2 border-2 border-riso-ink font-bold text-xs uppercase transition-all flex items-center justify-center gap-2 ${
              isIngesting
                ? 'bg-riso-darkgray text-riso-ink cursor-not-allowed shadow-none'
                : 'bg-riso-yellow text-riso-ink hover:bg-riso-pink hover:text-riso-paper shadow-riso-sm hover:-translate-x-px hover:-translate-y-px active:translate-x-px active:translate-y-px'
            }`}
          >
            {isIngesting
              ? <><Loader size={14} className="animate-spin" /> INGESTING CHUNKS...</>
              : <><RefreshCw size={14} /> INGEST PDF DOCUMENTS</>
            }
          </button>
        </div>

        {/* Live progress panel — visible only during ingestion */}
        {isIngesting && (
          <div className="border-2 border-riso-ink bg-riso-paper p-3 animate-pop-in">
            {/* Phase header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-riso-ink">
                <Zap size={11} className="text-riso-pink" />
                <span>{phaseLabel}</span>
              </div>
              <span className="text-[10px] font-mono text-riso-ink/60 border border-riso-ink/20 px-1.5 py-0.5">
                {String(Math.floor(elapsedSecs / 60)).padStart(2, '0')}:{String(elapsedSecs % 60).padStart(2, '0')} elapsed
              </span>
            </div>

            {/* Progress bar — shown during embedding phase */}
            {progress?.phase === 'embedding' && progress.total > 0 && (
              <div className="mb-2">
                <div className="flex justify-between text-[10px] font-mono text-riso-ink mb-1">
                  <span>{progress.current} / {progress.total} chunks</span>
                  <span className="font-bold">{pct}%</span>
                </div>
                {/* Track */}
                <div className="w-full h-4 border-2 border-riso-ink bg-riso-gray relative overflow-hidden">
                  {/* Animated fill */}
                  <div
                    className="h-full bg-riso-blue transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                  {/* Scan line animation */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
                    style={{ animationDuration: '1.5s' }}
                  />
                </div>
              </div>
            )}

            {/* Non-embedding phases: indeterminate striped bar */}
            {progress?.phase && !['embedding', 'done', 'error', 'idle'].includes(progress.phase) && (
              <div className="mb-2">
                <div className="w-full h-3 border-2 border-riso-ink bg-riso-gray overflow-hidden relative">
                  <div className="absolute inset-0 flex">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="h-full flex-1 animate-pulse"
                        style={{
                          background: i % 2 === 0 ? '#FFD200' : 'transparent',
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '1s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Status message */}
            <p className="text-[10px] font-mono text-riso-ink/70 truncate">
              {progress?.phase === 'error'
                ? <span className="text-riso-pink font-bold">⚠ {progress.error}</span>
                : progress?.message || 'Working...'
              }
            </p>
          </div>
        )}

        {/* Indexed documents list */}
        {!isIngesting && documents.length > 0 && (
          <div className="pt-3 border-t border-dashed border-riso-ink">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-riso-ink mb-2">
              INDEXED SOURCE FILES ({documents.length}):
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {documents.map((doc, idx) => (
                <li
                  key={idx}
                  className="bg-riso-paper border border-riso-ink px-2 py-1 flex items-center gap-1.5 text-xs overflow-hidden"
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

    </div>
  );
}
