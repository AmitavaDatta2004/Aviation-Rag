# AIRMAN // Flight Doc AI Chat

**AIRMAN** is a highly specialized, hallucination-resistant Retrieval-Augmented Generation (RAG) web application tailored for aviation manuals and documentation. It employs a **Hybrid RAG** approach—combining semantic vector search with exact-match keyword search (BM25)—and utilizes a custom prompt safeguard to ensure the LLM strictly grounds its answers in the provided aviation manuals without injecting external, potentially fatal, unverified knowledge.

The UI is built with a custom **Risograph-inspired aesthetic**, combining sharp typography, misregistration accents, and a distinct tactical feel suitable for flight documentation.

---

## 🌟 Key Features

*   **Hybrid Search Pipeline**: Merges Local Vector Similarity (Transformers.js) with BM25 Keyword Search for ultra-precise retrieval, excelling at both conceptual queries and exact part number/acronym lookups.
*   **100% Local Embeddings**: Uses `Xenova/all-MiniLM-L6-v2` via ONNX Runtime to generate 384-dimensional embeddings directly in Node.js. **No rate limits, no API costs, and instant ingestion.**
*   **Hallucination Safeguards**:
    *   **Prompt Enforcement**: The LLM is explicitly forbidden from employing pre-existing weights outside the retrieved chunks.
    *   **Refusal Filtering**: Enforces strict "I don't know" protocols when information is absent from the manuals.
*   **Blazing Fast Generation**: Uses the **Groq API** (Llama 3 8B / 70B) for instant LLM synthesis and reranking.
*   **Live Ingestion Dashboard**: Visual tracking of the 4-phase ingestion process (Parsing → Chunking → Local Embedding → Writing Indexes).

---

```text
=======================================================================
               PHASE 1: DATA INGESTION & INDEXING
=======================================================================

   [ PDF Manuals ]
          │
          ▼  (pdfjs-dist)
   [ Text Extraction ]
          │
          ▼  (Recursive Character Split)
   [ Text Chunks ]
          │
      ┌───┴────────────────────────────┐
      │                                │
      ▼  (Transformers.js)             ▼  (wink-bm25)
 [ Local Embeddings ]          [ Keyword Tokens ]
 [ (384-dim Vector) ]                  │
      │                                │
      ▼  (batchInsertItems)            ▼
 [( Vectra Vector DB )]        [( BM25 Keyword DB )]


=======================================================================
               PHASE 2: QUERY & HYBRID RETRIEVAL
=======================================================================

                   [ User Query ]
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼  (Transformers.js)          ▼  (Tokenization)
  [ Query Embedding ]           [ Query Keywords ]
          │                             │
          ▼                             ▼
 [( Vectra Vector DB )]        [( BM25 Keyword DB )]
          │                             │
          ▼                             ▼
 [ Semantic Results ]          [ Exact Match Results ]
          │                             │
          └──────────────┬──────────────┘
                         │
                         ▼
             [ Combine & Deduplicate ]
                         │
                         ▼  (Groq API)
             [ LLM Reranker (Top N) ]


=======================================================================
               PHASE 3: GENERATION & SAFEGUARDS
=======================================================================

                         │
                         ▼
               [ Prompt Builder ]
        (Injects context + Strict Rules)
                         │
                         ▼
                   [ Groq LLM ]
                         │
                         ▼
               [ Refusal Filter ]
    (Forces "I don't know" if not in text)
                         │
                         ▼
                [ Final Answer ]
                  (User UI)
```

---

## 🏗️ Architecture Stack

*   **Framework**: Next.js 15 (App Router)
*   **Styling**: Tailwind CSS v4 (Custom Risograph Theme)
*   **PDF Parsing**: `pdfjs-dist`
*   **Embeddings**: Transformers.js (`@xenova/transformers` - fully local)
*   **Vector Database**: Vectra (Local JSON-based vector index)
*   **Keyword Database**: `wink-bm25-text-search`
*   **LLM Provider**: Groq API
*   **Language**: TypeScript

---

## 🚀 Getting Started

### 1. Prerequisites

*   **Node.js 18+** installed.
*   A **Groq API Key**. You can get one for free at [console.groq.com](https://console.groq.com/).

### 2. Installation

Clone the repository and install dependencies:

```bash
# Navigate to the project directory
cd "Aviation Rag"

# Install all required packages
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root of your project and add your Groq API Key:

```env
GROQ_API_KEY=your_groq_api_key_here
NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key_here
```
*(Note: Gemini was previously used for embeddings but was replaced with local Transformers.js. You no longer need a Gemini API key.)*

### 4. Running the Development Server

Start the Next.js server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📚 Managing Documents (Ingestion)

To teach the AI about your specific aircraft manuals:

1.  **Add PDFs**: Drop your aviation PDF manuals (e.g., `Instruments.pdf`, `POH.pdf`) into the `data/pdfs/` folder.
2.  **Ingest**: Open the app in your browser and click the **"INGEST PDF DOCUMENTS"** button in the System Status Panel.
3.  **Wait for processing**: The system will parse the text, split it into chunks, generate local embeddings (at roughly ~500 chunks per minute), and write the vector and BM25 indexes to disk.
4.  **Ready**: Once the status badge turns green (`INDEX READY`), you can start asking questions!

*The vector indexes are stored locally in `data/index/`.*

---

## 🧪 Evaluation & Benchmarking

The project includes an automated evaluation script to test the accuracy and refusal capabilities of the RAG pipeline against a set of predetermined questions.

To run the benchmark:
```bash
npm run evaluate
```

This will run through a matrix of queries and generate a detailed Markdown report at `evaluation/report.md` detailing the system's Precision, Recall, and Strictness.

---

## 🎨 UI & Theming Notes

The UI utilizes a bespoke "Risograph" design system configured directly in `app/globals.css`. It features:
*   `bg-riso-paper`: Off-white textured background.
*   `text-riso-ink`: Off-black deep text for stark contrast.
*   `riso-pink`, `riso-blue`, `riso-yellow`, `riso-teal`: CMYK-inspired accent colors used for status badges, progress bars, and hover states.

---

## ⚠️ Disclaimer

**This software is for demonstration and educational purposes only.** Do not use AI-generated outputs as a substitute for official aircraft flight manuals (AFM), Pilot's Operating Handbooks (POH), or certified flight instruction. Always consult official documentation for flight operations.
