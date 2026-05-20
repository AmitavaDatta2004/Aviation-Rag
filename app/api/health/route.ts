import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Force dynamic to prevent Next.js from caching the health check response during build
export const dynamic = 'force-dynamic';

export async function GET() {
  // Vectra stores the vector index at data/index/index.json
  const indexPath = path.join(process.cwd(), 'data', 'index', 'index.json');

  if (!fs.existsSync(indexPath)) {
    return NextResponse.json({
      status: 'ok',
      index_loaded: false,
      chunks_count: 0,
      documents: []
    });
  }

  try {
    const rawData = fs.readFileSync(indexPath, 'utf-8');
    const indexData = JSON.parse(rawData);

    // Vectra stores items as an array under the 'items' key
    const items: any[] = Array.isArray(indexData.items) ? indexData.items : [];
    const chunksCount = items.length;
    const documents: string[] = Array.from(
      new Set(items.map((item: any) => item.metadata?.doc_name).filter(Boolean))
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
