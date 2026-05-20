import Groq from 'groq-sdk';
import { CandidateChunk } from './reranker';

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

export const REFUSAL_PHRASE = "This information is not available in the provided document(s).";

export interface LLMResponse {
  answer: string;
  refused: boolean;
}

/**
 * Sends a question and retrieved document chunks to Groq for grounded answer generation.
 */
export async function askLLM(question: string, chunks: CandidateChunk[]): Promise<LLMResponse> {
  const client = getGroqClient();

  // Construct context block with citation markers
  const contextBlock = chunks.map((chunk, index) => {
    return `[Chunk ${index + 1} — ${chunk.doc_name}, Page ${chunk.page_number}]
${chunk.text}`;
  }).join('\n\n');

  const systemPrompt = `You are an aviation assistant. You must answer ONLY using the context provided below. Do not use any outside knowledge whatsoever. If the answer cannot be found in the context, respond with exactly this phrase and nothing else:
"${REFUSAL_PHRASE}"`;

  const userPrompt = `CONTEXT:
${contextBlock}

USER QUESTION:
${question}`;

  const chatCompletion = await client.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.0, // Low temperature for high factual grounding
  });

  const answer = chatCompletion.choices[0]?.message?.content?.trim() || '';

  // Determine if the LLM refused to answer because info wasn't in context
  const refused = answer.includes(REFUSAL_PHRASE) || answer === REFUSAL_PHRASE;

  return {
    answer,
    refused,
  };
}
