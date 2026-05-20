import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

// Retrieve the Gemini API key from environment variables
const apiKey = process.env.GEMINI_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY || '';
    if (!key || key === 'your_gemini_key_here') {
      throw new Error('GEMINI_API_KEY is not configured in .env.local');
    }
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

// Gemini Embedding 2 — latest stable GA model (3072-dim vectors)
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_MODEL_PATH = `models/${EMBEDDING_MODEL}`;

// Free tier: 100 requests per minute per model.
// We send batches of 50 and wait 35s between batches to stay safely under the limit.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 35_000; // 35 seconds between batches

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function up to maxRetries times on 429 rate-limit errors,
 * parsing the retryDelay from the API error response when available.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const message: string = err?.message || '';

      // Only retry on rate-limit (429) errors
      if (!message.includes('429') && !message.includes('Too Many Requests') && !message.includes('RESOURCE_EXHAUSTED')) {
        throw err;
      }

      // Try to parse the retryDelay hint from the error message (e.g. "retry in 23s")
      const delayMatch = message.match(/retry[^0-9]*(\d+(?:\.\d+)?)\s*s/i);
      const retryAfterSecs = delayMatch ? parseFloat(delayMatch[1]) : 30;
      const waitMs = Math.ceil(retryAfterSecs * 1000) + 2000; // add 2s buffer

      console.warn(`[Embeddings] Rate limit hit. Retrying in ${(waitMs / 1000).toFixed(0)}s (attempt ${attempt + 1}/${maxRetries})...`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

/**
 * Generates a vector embedding for the given text using Gemini Embedding 2.
 */
export async function getEmbedding(text: string, isQuery = false): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await withRetry(() =>
    model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType: isQuery ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT,
    })
  );

  if (!result.embedding || !result.embedding.values) {
    throw new Error('Failed to retrieve embedding values from Gemini API.');
  }

  return result.embedding.values;
}

/**
 * Generates embeddings in rate-limit-aware batches.
 * Free tier cap: 100 requests/min → we use batches of 50 with 35s delays.
 */
export async function getEmbeddingsBatch(
  texts: string[],
  isQuery = false,
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  const embeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

  console.log(`[Embeddings] Starting batch embedding: ${texts.length} texts in ${totalBatches} batches of ${BATCH_SIZE}`);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const textChunk = texts.slice(i, i + BATCH_SIZE);

    console.log(`[Embeddings] Batch ${batchIndex}/${totalBatches} — ${textChunk.length} texts...`);

    const result = await withRetry(() =>
      model.batchEmbedContents({
        requests: textChunk.map(text => ({
          content: { role: 'user', parts: [{ text }] },
          taskType: isQuery ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT,
          model: EMBEDDING_MODEL_PATH,
        })),
      })
    );

    if (!result.embeddings) {
      throw new Error(`Failed to retrieve batch embeddings at batch ${batchIndex}.`);
    }

    embeddings.push(...result.embeddings.map(e => e.values));
    onProgress?.(embeddings.length, texts.length);

    // Respect the 100 req/min free tier limit — wait between batches
    if (batchIndex < totalBatches) {
      console.log(`[Embeddings] Batch ${batchIndex} done. Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`[Embeddings] All ${embeddings.length} embeddings generated successfully.`);
  return embeddings;
}
