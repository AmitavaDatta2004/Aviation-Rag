import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { parsePDF } from '@/lib/pdfParser';
import { chunkPages } from '@/lib/chunker';
import { getEmbeddingsBatch } from '@/lib/embeddings';
import { clearVectorStore, addChunksToVectorStore } from '@/lib/vectorstore';
import { clearBM25Index, buildBM25Index } from '@/lib/bm25';

export const dynamic = 'force-dynamic';

export async function POST() {
  const pdfsDir = path.join(process.cwd(), 'data', 'pdfs');

  // Create PDFs directory if not exists
  if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
  }

  // Find all PDF files in data/pdfs/
  const files = fs.readdirSync(pdfsDir);
  const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    return NextResponse.json({
      status: 'error',
      message: 'No PDF files found in data/pdfs/. Please upload some aviation PDFs and try again.'
    }, { status: 400 });
  }

  try {
    // 1. Clear previous index stores to ensure clean ingestion
    await clearVectorStore();
    await clearBM25Index();

    const allPages: any[] = [];
    const documentsProcessed: string[] = [];

    // 2. Parse each PDF
    for (const file of pdfFiles) {
      const filePath = path.join(pdfsDir, file);
      const pages = await parsePDF(filePath);
      allPages.push(...pages);
      documentsProcessed.push(file);
    }

    if (allPages.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'Could not extract text from the provided PDFs. Please ensure they contain selectable text.'
      }, { status: 400 });
    }

    // 3. Chunk pages into 500-token chunks with 50-token overlap
    const chunks = chunkPages(allPages);

    if (chunks.length === 0) {
      return NextResponse.json({
        status: 'error',
        message: 'No chunks generated from the pages.'
      }, { status: 400 });
    }

    // 4. Generate Embeddings for all chunks (utilizing fast batching)
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await getEmbeddingsBatch(chunkTexts, false);

    // 5. Store embeddings + metadata in Vectra local store
    await addChunksToVectorStore(chunks, embeddings);

    // 6. Build and store the BM25 keyword index
    await buildBM25Index(chunks);

    return NextResponse.json({
      status: 'success',
      chunks_indexed: chunks.length,
      documents_processed: documentsProcessed
    });
  } catch (e: any) {
    console.error('Ingestion pipeline failed:', e);
    return NextResponse.json({
      status: 'error',
      message: e.message || 'An error occurred during PDF ingestion.'
    }, { status: 500 });
  }
}
