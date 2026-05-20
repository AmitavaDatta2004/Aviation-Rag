import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY || '';
let groq: Groq | null = null;

if (apiKey && apiKey !== 'your_groq_key_here') {
  groq = new Groq({ apiKey });
}

function getGroqClient(): Groq {
  if (!groq) {
    const key = process.env.GROQ_API_KEY || '';
    if (!key || key === 'your_groq_key_here') {
      throw new Error('GROQ_API_KEY is not configured in .env.local');
    }
    groq = new Groq({ apiKey: key });
  }
  return groq;
}

export interface CandidateChunk {
  chunk_id: string;
  doc_name: string;
  page_number: number;
  text: string;
  vector_score?: number;
  bm25_score?: number;
}

/**
 * Scores and reranks candidate chunks against the user query using Groq.
 */
export async function rerankChunks(
  query: string,
  candidates: CandidateChunk[],
  limit = 5
): Promise<CandidateChunk[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= limit) return candidates;

  try {
    const client = getGroqClient();

    // Format the candidates list for the LLM
    const chunksPromptList = candidates.map((c, i) => {
      return `[ID: candidate_${i}]\nDocument: ${c.doc_name} (Page ${c.page_number})\nText: ${c.text}\n---`;
    }).join('\n\n');

    const prompt = `You are a search reranker. Given the USER QUERY and the candidate CHUNKS, rate how relevant each chunk is to answering the query on a scale of 1 to 10 (10 being highly relevant and containing direct answers, 1 being completely irrelevant).

USER QUERY: "${query}"

CHUNKS TO RERANK:
${chunksPromptList}

You must return a JSON object with a single key "scores" mapping to an array of objects. Each object must have "id" (e.g. "candidate_0") and "score" (a number between 1 and 10).
Example output:
{
  "scores": [
    { "id": "candidate_0", "score": 9.5 },
    { "id": "candidate_1", "score": 3.0 }
  ]
}`;

    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a precise search relevance rater. You output only raw JSON conforming to the requested schema.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '{}';
    const responseJson = JSON.parse(responseText);
    const scoresArray = responseJson.scores as Array<{ id: string; score: number }>;

    const scoreMap = new Map<number, number>();
    if (Array.isArray(scoresArray)) {
      scoresArray.forEach(item => {
        const indexMatch = item.id.match(/\d+/);
        if (indexMatch) {
          const index = parseInt(indexMatch[0], 10);
          scoreMap.set(index, item.score);
        }
      });
    }

    // Map candidate chunks to their scores, falling back to 1.0 if not scored
    const scoredCandidates = candidates.map((candidate, i) => {
      const score = scoreMap.has(i) ? scoreMap.get(i)! : 1.0;
      return { candidate, score };
    });

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates.slice(0, limit).map(item => item.candidate);
  } catch (e) {
    console.warn('Rerank failed or GROQ_API_KEY missing. Falling back to default retrieval order.', e);
    // Graceful fallback to first N candidates
    return candidates.slice(0, limit);
  }
}
