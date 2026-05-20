import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore
import bm25 from 'wink-bm25-text-search';
import { Chunk } from './chunker';

const BM25_INDEX_PATH = path.join(process.cwd(), 'data', 'index', 'bm25.json');
const CHUNKS_METADATA_PATH = path.join(process.cwd(), 'data', 'index', 'chunks.json');

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could', 
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 
  'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 
  'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 
  'why', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

// Helper to define preprocessing tasks
function getPrepTasks() {
  return [
    (str: string) => str.toLowerCase(),
    (str: string) => str.split(/[^a-zA-Z0-9]+/).filter(Boolean),
    (tokens: string[]) => tokens.filter(t => !STOP_WORDS.has(t))
  ];
}

export interface BM25SearchResult {
  chunk_id: string;
  doc_name: string;
  page_number: number;
  text: string;
  bm25_score: number;
}

// In-memory cache for metadata and loaded engines
let cachedChunks: Record<string, Chunk> = {};
let cachedEngine: any = null;

function ensureIndexDirExists() {
  const dir = path.dirname(BM25_INDEX_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Build the BM25 index and save it to disk along with chunk metadata.
 */
export async function buildBM25Index(chunks: Chunk[]): Promise<void> {
  ensureIndexDirExists();
  
  const engine = bm25();
  engine.defineConfig({
    fldWeights: { text: 1 }
  });
  engine.definePrepTasks(getPrepTasks());

  // Add all chunks as documents to the index
  for (const chunk of chunks) {
    engine.addDoc({ text: chunk.text }, chunk.chunk_id);
  }

  // Export JSON string prior to calling consolidate
  const serializedIndex = engine.exportJSON();
  
  // Save both the BM25 index and chunk metadata mapping
  fs.writeFileSync(BM25_INDEX_PATH, serializedIndex, 'utf-8');
  
  const metadataMap: Record<string, Chunk> = {};
  for (const chunk of chunks) {
    metadataMap[chunk.chunk_id] = chunk;
  }
  fs.writeFileSync(CHUNKS_METADATA_PATH, JSON.stringify(metadataMap, null, 2), 'utf-8');

  // Clear memory cache so that it reloads on next search
  cachedEngine = null;
  cachedChunks = {};
}

/**
 * Loads the BM25 search engine and metadata from disk.
 */
function loadBM25Engine() {
  if (cachedEngine && Object.keys(cachedChunks).length > 0) {
    return { engine: cachedEngine, chunks: cachedChunks };
  }

  if (!fs.existsSync(BM25_INDEX_PATH) || !fs.existsSync(CHUNKS_METADATA_PATH)) {
    return null;
  }

  try {
    const serializedIndex = fs.readFileSync(BM25_INDEX_PATH, 'utf-8');
    const metadataRaw = fs.readFileSync(CHUNKS_METADATA_PATH, 'utf-8');

    const engine = bm25();
    // Config MUST be defined before prepTasks — required by wink-bm25-text-search
    engine.defineConfig({ fldWeights: { text: 1 } });
    engine.definePrepTasks(getPrepTasks());
    engine.importJSON(serializedIndex);
    engine.consolidate(); // Finalize search engine

    cachedEngine = engine;
    cachedChunks = JSON.parse(metadataRaw);

    return { engine, chunks: cachedChunks };
  } catch (e) {
    console.error('Error loading BM25 engine:', e);
    return null;
  }
}

/**
 * Queries the BM25 index for the top matching chunks.
 */
export function queryBM25(queryText: string, limit = 10): BM25SearchResult[] {
  const loaded = loadBM25Engine();
  if (!loaded) {
    return [];
  }

  const { engine, chunks } = loaded;
  
  // Search runs and returns array of [docId, score] sorted descending
  const results = engine.search(queryText);
  const slicedResults = results.slice(0, limit);

  return slicedResults.map(([chunkId, score]: [string, number]) => {
    const chunk = chunks[chunkId];
    return {
      chunk_id: chunkId,
      doc_name: chunk ? chunk.doc_name : 'Unknown',
      page_number: chunk ? chunk.page_number : 0,
      text: chunk ? chunk.text : '',
      bm25_score: score,
    };
  });
}

/**
 * Clean up the index files from disk.
 */
export async function clearBM25Index(): Promise<void> {
  cachedEngine = null;
  cachedChunks = {};
  if (fs.existsSync(BM25_INDEX_PATH)) {
    try {
      fs.unlinkSync(BM25_INDEX_PATH);
    } catch {}
  }
  if (fs.existsSync(CHUNKS_METADATA_PATH)) {
    try {
      fs.unlinkSync(CHUNKS_METADATA_PATH);
    } catch {}
  }
}

/**
 * Check if the BM25 index files exist on disk.
 */
export function isIndexAvailable(): boolean {
  return fs.existsSync(BM25_INDEX_PATH) && fs.existsSync(CHUNKS_METADATA_PATH);
}
