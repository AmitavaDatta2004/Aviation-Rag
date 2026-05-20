import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Force dynamic to prevent Next.js from caching the health check response during build
export const dynamic = 'force-dynamic';

export async function GET() {
  // Use chunks.json (BM25 metadata — small, fast) instead of the 28MB index.json
  const chunksPath = path.join(process.cwd(), 'data', 'index', 'chunks.json');

  if (!fs.existsSync(chunksPath)) {
    return NextResponse.json({
      status: 'ok',
      index_loaded: false,
      chunks_count: 0,
      documents: []
    });
  }

  try {
    const rawData = fs.readFileSync(chunksPath, 'utf-8');
    // chunks.json is a map of { chunk_id: ChunkObject }
    const chunksMap = JSON.parse(rawData) as Record<string, any>;
    const chunks = Object.values(chunksMap);
    const chunksCount = chunks.length;
    const documents: string[] = Array.from(
      new Set(chunks.map((c: any) => c.doc_name).filter(Boolean))
    );

    return NextResponse.json({
      status: 'ok',
      index_loaded: chunksCount > 0,
      chunks_count: chunksCount,
      documents
    });
  } catch (e: any) {
    return NextResponse.json({
      status: 'error',
      message: e.message || 'Failed to read index files.',
      index_loaded: false,
      chunks_count: 0,
      documents: []
    }, { status: 500 });
  }
}
