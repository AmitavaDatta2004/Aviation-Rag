import { NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/embeddings';
import { queryVectorStore } from '@/lib/vectorstore';
import { queryBM25, isIndexAvailable } from '@/lib/bm25';
import { rerankChunks, CandidateChunk } from '@/lib/reranker';
import { askLLM } from '@/lib/llm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { question, debug = false } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({
        status: 'error',
        message: 'Question is required and must be a string.'
      }, { status: 400 });
    }

    // 1. Verify index files are present on disk
    if (!isIndexAvailable()) {
      return NextResponse.json({
        status: 'error',
        message: 'No documents have been ingested yet. Please upload aviation PDFs to data/pdfs/ and run ingestion first.'
      }, { status: 400 });
    }

    // 2. Generate embedding for query (isQuery = true)
    let queryVector: number[];
    try {
      queryVector = await getEmbedding(question, true);
    } catch (e: any) {
      return NextResponse.json({
        status: 'error',
        message: `Failed to embed query: ${e.message}`
      }, { status: 500 });
    }

    // 3. Fetch top 5 vector results
    const vectorResults = await queryVectorStore(queryVector, 5);

    // 4. Fetch top 10 BM25 results
    const bm25Results = queryBM25(question, 10);

    // 5. Merge and Deduplicate candidates
    const candidateMap = new Map<string, CandidateChunk>();

    for (const vr of vectorResults) {
      candidateMap.set(vr.chunk_id, {
        chunk_id: vr.chunk_id,
        doc_name: vr.doc_name,
        page_number: vr.page_number,
        text: vr.text,
        vector_score: vr.similarity_score
      });
    }

    for (const br of bm25Results) {
      if (candidateMap.has(br.chunk_id)) {
        const existing = candidateMap.get(br.chunk_id)!;
        existing.bm25_score = br.bm25_score;
      } else {
        candidateMap.set(br.chunk_id, {
          chunk_id: br.chunk_id,
          doc_name: br.doc_name,
          page_number: br.page_number,
          text: br.text,
          bm25_score: br.bm25_score
        });
      }
    }

    const mergedCandidates = Array.from(candidateMap.values());

    // 6. Rerank candidates using Groq to choose top 5
    const rerankedChunks = await rerankChunks(question, mergedCandidates, 5);

    // 7. Grounded Answer generation via Groq LLM
    const llmResult = await askLLM(question, rerankedChunks);

    const refused = llmResult.refused;

    // Citations are only included if the assistant actually used the context (not a refusal or pleasantry)
    const citations = llmResult.requiresCitations
      ? rerankedChunks.map(chunk => ({
          doc_name: chunk.doc_name,
          page_number: chunk.page_number,
          chunk_id: chunk.chunk_id,
        }))
      : [];

    const response: any = {
      answer: llmResult.answer,
      citations,
      refused,
      debug
    };

    if (debug) {
      response.retrieved_chunks = rerankedChunks.map(chunk => ({
        chunk_id: chunk.chunk_id,
        doc_name: chunk.doc_name,
        page_number: chunk.page_number,
        text: chunk.text,
        similarity_score: chunk.vector_score ?? null,
        bm25_score: chunk.bm25_score ?? null
      }));
    }

    return NextResponse.json(response);
  } catch (e: any) {
    console.error('Ask API error:', e);
    return NextResponse.json({
      status: 'error',
      message: e.message || 'An error occurred during query processing.'
    }, { status: 500 });
  }
}
