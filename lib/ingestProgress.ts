/**
 * lib/ingestProgress.ts
 *
 * Shared in-memory singleton for tracking ingestion progress.
 * Since all Next.js API routes run in the same Node.js process,
 * writing here from /api/ingest is immediately readable from /api/ingest/progress.
 */

export type IngestPhase =
  | 'idle'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'done'
  | 'error';

export interface IngestProgress {
  phase: IngestPhase;
  current: number;   // chunks embedded so far
  total: number;     // total chunks to embed
  message: string;   // human-readable status line
  error?: string;
  startedAt?: number;
}

// Mutable singleton — mutated directly by the ingest route
export const ingestProgress: IngestProgress = {
  phase: 'idle',
  current: 0,
  total: 0,
  message: 'Ready.',
};

export function resetProgress() {
  ingestProgress.phase = 'idle';
  ingestProgress.current = 0;
  ingestProgress.total = 0;
  ingestProgress.message = 'Ready.';
  ingestProgress.error = undefined;
  ingestProgress.startedAt = undefined;
}

export function setProgress(patch: Partial<IngestProgress>) {
  Object.assign(ingestProgress, patch);
}
