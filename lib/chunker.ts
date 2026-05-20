import { PDFPageData } from './pdfParser';

export interface Chunk {
  chunk_id: string;
  doc_name: string;
  page_number: number;
  text: string;
}

// Approximation: 1 token ~= 4 characters or 0.75 words.
// We will target ~500 tokens (approx 2000 characters) and ~50 tokens overlap (approx 200 characters).
const TARGET_CHUNK_CHARS = 2000;
const OVERLAP_CHARS = 200;

export function chunkPages(pages: PDFPageData[]): Chunk[] {
  const chunks: Chunk[] = [];

  for (const page of pages) {
    const docCleanName = page.docName.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const sentences = splitIntoSentences(page.text);

    let currentChunkSentences: string[] = [];
    let currentChunkCharCount = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const sentenceLen = sentence.length;

      // If adding this sentence exceeds target size, and we already have some sentences, save current chunk
      if (currentChunkCharCount + sentenceLen > TARGET_CHUNK_CHARS && currentChunkSentences.length > 0) {
        const text = currentChunkSentences.join(' ');
        chunks.push({
          chunk_id: `${docCleanName}_pg${page.pageNumber}_c${String(chunkIndex++).padStart(3, '0')}`,
          doc_name: page.docName,
          page_number: page.pageNumber,
          text,
        });

        // Determine overlap: roll back sentences until we match OVERLAP_CHARS
        const overlapSentences: string[] = [];
        let overlapCharCount = 0;
        for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
          const sent = currentChunkSentences[i];
          if (overlapCharCount + sent.length <= OVERLAP_CHARS || overlapSentences.length === 0) {
            overlapSentences.unshift(sent);
            overlapCharCount += sent.length + 1; // +1 for join space
          } else {
            break;
          }
        }

        currentChunkSentences = [...overlapSentences, sentence];
        currentChunkCharCount = overlapCharCount + sentenceLen;
      } else {
        currentChunkSentences.push(sentence);
        currentChunkCharCount += (currentChunkCharCount > 0 ? 1 : 0) + sentenceLen;
      }
    }

    // Save final chunk for the page
    if (currentChunkSentences.length > 0) {
      const text = currentChunkSentences.join(' ');
      chunks.push({
        chunk_id: `${docCleanName}_pg${page.pageNumber}_c${String(chunkIndex).padStart(3, '0')}`,
        doc_name: page.docName,
        page_number: page.pageNumber,
        text,
      });
    }
  }

  return chunks;
}

/**
 * Splits text into sentences using punctuation boundaries (. ! ?) while handling abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // Simple sentence boundary splitting regex
  // Match period, exclamation, question mark followed by space and uppercase letter, or end of string.
  // We use lookahead/lookbehind or a simpler split-and-reconstruct approach.
  const rawSegments = text.split(/([.!?])\s+/);
  const sentences: string[] = [];

  for (let i = 0; i < rawSegments.length; i += 2) {
    const sentenceBody = rawSegments[i];
    const punctuation = rawSegments[i + 1] || '';
    const fullSentence = (sentenceBody + punctuation).trim();
    if (fullSentence) {
      // Avoid empty/micro segments
      sentences.push(fullSentence);
    }
  }

  // Handle fallback if a single sentence is extremely long (rare in textbooks, but possible)
  const finalSentences: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length > TARGET_CHUNK_CHARS) {
      // Split sentence into smaller sub-chunks by words
      const words = sentence.split(' ');
      let currentWordBlock: string[] = [];
      let currentLength = 0;
      for (const word of words) {
        if (currentLength + word.length > TARGET_CHUNK_CHARS && currentWordBlock.length > 0) {
          finalSentences.push(currentWordBlock.join(' '));
          currentWordBlock = [word];
          currentLength = word.length;
        } else {
          currentWordBlock.push(word);
          currentLength += word.length + 1;
        }
      }
      if (currentWordBlock.length > 0) {
        finalSentences.push(currentWordBlock.join(' '));
      }
    } else {
      finalSentences.push(sentence);
    }
  }

  return finalSentences;
}
