/**
 * lib/embeddings.ts
 *
 * Local embedding engine using Transformers.js (ONNX Runtime).
 * Model: Xenova/all-MiniLM-L6-v2  →  384-dimensional vectors
 * Zero API keys, zero rate limits, zero cost.
 * Model (~23MB) is downloaded once on first run and cached automatically.
 */

// @ts-ignore — @xenova/transformers ships its own types
import { pipeline, env } from '@xenova/transformers';

// Run ONNX entirely in the Node.js process — no worker threads
env.backends.onnx.wasm.numThreads = 1;
env.allowRemoteModels = true;
env.useBrowserCache = false;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

/** Cached singleton — the model is loaded once and reused across all requests */
let _extractor: any = null;

async function getExtractor(): Promise<any> {
  if (!_extractor) {
    console.log('[Embeddings] Loading Xenova/all-MiniLM-L6-v2 model (first run may take a moment)...');
    _extractor = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // use int8 quantized ONNX model (~23MB)
    });
    console.log('[Embeddings] Model loaded and ready.');
  }
  return _extractor;
}

/**
 * Generate a single 384-dim embedding vector for the given text.
 * The `isQuery` param is kept for API compatibility with the rest of the pipeline.
 */
export async function getEmbedding(text: string, _isQuery = false): Promise<number[]> {
  const extractor = await getExtractor();
  // Cast to any to bypass overly broad union return type from @xenova/transformers
  const output: any = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Generate embeddings for a batch of texts.
 * Runs fully locally — no API calls, no rate limits, no delays.
 */
export async function getEmbeddingsBatch(
  texts: string[],
  _isQuery = false,
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const extractor = await getExtractor();
  const embeddings: number[][] = [];
  const total = texts.length;

  console.log(`[Embeddings] Starting local batch: ${total} texts with ${MODEL_NAME}`);

  for (let i = 0; i < texts.length; i++) {
    const output: any = await extractor(texts[i], { pooling: 'mean', normalize: true });
    embeddings.push(Array.from(output.data as Float32Array));
    onProgress?.(i + 1, total);

    if ((i + 1) % 50 === 0 || i + 1 === total) {
      console.log(`[Embeddings] ${i + 1}/${total} done`);
    }
  }

  console.log(`[Embeddings] All ${embeddings.length} embeddings generated successfully.`);
  return embeddings;
}
