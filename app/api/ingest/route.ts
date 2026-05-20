import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { parsePDF } from '@/lib/pdfParser';
import { chunkPages } from '@/lib/chunker';
import { getEmbeddingsBatch } from '@/lib/embeddings';
import { clearVectorStore, addChunksToVectorStore } from '@/lib/vectorstore';
import { clearBM25Index, buildBM25Index } from '@/lib/bm25';
import { setProgress, resetProgress } from '@/lib/ingestProgress';

export const dynamic = 'force-dynamic';

export async function POST() {
  const pdfsDir = path.join(process.cwd(), 'data', 'pdfs');

  if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
  }

  const files = fs.readdirSync(pdfsDir);
  const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    return NextResponse.json({
      status: 'error',
      message: 'No PDF files found in data/pdfs/. Please upload some aviation PDFs and try again.'
    }, { status: 400 });
  }

  // Reset progress state for this new run
  resetProgress();
  setProgress({ phase: 'parsing', startedAt: Date.now(), message: `Parsing ${pdfFiles.length} PDF file(s)...` });

  try {
    // 1. Clear previous indexes
    await clearVectorStore();
    await clearBM25Index();

    // 2. Parse PDFs
    const allPages: any[] = [];
    const documentsProcessed: string[] = [];

    for (const file of pdfFiles) {
      setProgress({ message: `Parsing: ${file}` });
      const filePath = path.join(pdfsDir, file);
      const pages = await parsePDF(filePath);
      allPages.push(...pages);
      documentsProcessed.push(file);
    }

    if (allPages.length === 0) {
      setProgress({ phase: 'error', error: 'Could not extract text from PDFs.' });
      return NextResponse.json({ status: 'error', message: 'Could not extract text from the provided PDFs.' }, { status: 400 });
    }

    // 3. Chunk
    setProgress({ phase: 'chunking', message: 'Splitting pages into chunks...' });
    const chunks = chunkPages(allPages);

    if (chunks.length === 0) {
      setProgress({ phase: 'error', error: 'No chunks generated.' });
      return NextResponse.json({ status: 'error', message: 'No chunks generated from the pages.' }, { status: 400 });
    }

    // 4. Embed with live progress updates
    setProgress({
      phase: 'embedding',
      current: 0,
      total: chunks.length,
      message: `Embedding 0 / ${chunks.length} chunks...`,
    });

    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await getEmbeddingsBatch(
      chunkTexts,
      false,
      (done, total) => {
        setProgress({
          current: done,
          total,
          message: `Embedding ${done} / ${total} chunks...`,
        });
      }
    );

    // 5. Build vector + BM25 indexes
    setProgress({ phase: 'indexing', message: 'Writing vector index to disk...' });
    await addChunksToVectorStore(chunks, embeddings);

    setProgress({ message: 'Building BM25 keyword index...' });
    await buildBM25Index(chunks);

    // Done!
    setProgress({
      phase: 'done',
      current: chunks.length,
      total: chunks.length,
      message: `Done! Indexed ${chunks.length} chunks from ${documentsProcessed.length} file(s).`,
    });

    return NextResponse.json({
      status: 'success',
      chunks_indexed: chunks.length,
      documents_processed: documentsProcessed,
    });
  } catch (e: any) {
    console.error('Ingestion pipeline failed:', e);
    setProgress({ phase: 'error', error: e.message || 'Unknown error during ingestion.' });
    return NextResponse.json({
      status: 'error',
      message: e.message || 'An error occurred during PDF ingestion.'
    }, { status: 500 });
  }
}
