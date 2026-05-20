import * as path from 'path';
import * as fs from 'fs';
import { LocalIndex } from 'vectra';
import { Chunk } from './chunker';

const INDEX_DIR = path.join(process.cwd(), 'data', 'index');

function ensureDirectoryExists() {
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }
}

export async function getVectorIndex(): Promise<LocalIndex> {
  ensureDirectoryExists();
  const index = new LocalIndex(INDEX_DIR);
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }
  return index;
}

/**
 * Completely clears the vector store to prepare for a fresh ingestion.
 */
export async function clearVectorStore(): Promise<void> {
  if (fs.existsSync(INDEX_DIR)) {
    try {
      fs.rmSync(INDEX_DIR, { recursive: true, force: true });
    } catch (e) {
      console.error('Error clearing vector store directory:', e);
    }
  }
}

/**
 * Indexes chunks and their corresponding embeddings into Vectra.
 */
export async function addChunksToVectorStore(chunks: Chunk[], embeddings: number[][]): Promise<void> {
  const index = await getVectorIndex();

  console.log(`[Vectorstore] Preparing batch insert for ${chunks.length} items...`);
  const items = chunks.map((chunk, i) => ({
    vector: embeddings[i],
    metadata: {
      chunk_id: chunk.chunk_id,
      doc_name: chunk.doc_name,
      page_number: chunk.page_number,
      text: chunk.text,
    },
  }));

  await index.batchInsertItems(items);
  console.log(`[Vectorstore] Successfully batch inserted ${chunks.length} items.`);
}

export interface VectorSearchResult {
  chunk_id: string;
  doc_name: string;
  page_number: number;
  text: string;
  similarity_score: number;
}

/**
 * Queries the Vectra index for the top results matching the query vector.
 */
export async function queryVectorStore(queryVector: number[], limit = 5): Promise<VectorSearchResult[]> {
  const index = await getVectorIndex();
  const results = await index.queryItems(queryVector, '', limit);

  return results.map(r => ({
    chunk_id: r.item.metadata.chunk_id as string,
    doc_name: r.item.metadata.doc_name as string,
    page_number: r.item.metadata.page_number as number,
    text: r.item.metadata.text as string,
    similarity_score: r.score,
  }));
}
