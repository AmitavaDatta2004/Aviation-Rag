# Final Complete Blueprint — AIRMAN Aviation RAG Chat

---

## Project Name

**AIRMAN — Aviation Document AI Chat**

---

## What This System Does

A chat system that answers aviation questions **strictly and only** from provided aviation PDFs (PPL/CPL/ATPL textbooks, SOPs, manuals). User asks a question, system finds relevant document sections, Groq LLM answers using only those sections. Every answer has citations. If answer isn't in the documents, system explicitly refuses.

---

## Complete Tech Stack

| Layer        | Technology                           | Purpose                                     |
| ------------ | ------------------------------------ | ------------------------------------------- |
| Framework    | Next.js 14 (App Router)              | Full stack — frontend + backend in one     |
| Language     | TypeScript                           | Type safety throughout                      |
| Styling      | Tailwind CSS + shadcn/ui             | Clean professional UI                       |
| PDF Parsing  | `pdfjs-dist`                       | Extract text page by page with page numbers |
| Embeddings   | Transformers.js (`all-MiniLM-L6-v2`) | Convert text to vectors (100% local, free)  |
| Vector Store | Vectra (local)                       | Store + search vectors on disk              |
| LLM          | Groq API `llama-3.3-70b-versatile` | Generate grounded answers (free, fast)      |
| BM25 Search  | `wink-bm25-text-search`            | Keyword-based retrieval (Level 2)           |
| Environment  | `.env.local`                       | API key management                          |

---

## Environment Variables

```
GROQ_API_KEY=your_groq_key_here
*(Note: GEMINI_API_KEY was previously used but is no longer required as embeddings are now local)*
```

Nothing else. Completely free.

---

## Project Structure

```
airman-rag/
├── app/
│   ├── page.tsx                        # Main chat UI
│   ├── layout.tsx                      # Root layout
│   ├── globals.css                     # Global styles
│   └── api/
│       ├── ingest/route.ts             # POST /api/ingest
│       ├── ask/route.ts                # POST /api/ask
│       └── health/route.ts            # GET /api/health
│
├── lib/
│   ├── pdfParser.ts                    # PDF loading + text extraction
│   ├── chunker.ts                      # Text splitting logic
│   ├── embeddings.ts                   # Gemini embedding calls
│   ├── vectorstore.ts                  # Vectra operations
│   ├── bm25.ts                         # BM25 keyword search (Level 2)
│   ├── reranker.ts                     # Reranking logic (Level 2)
│   └── llm.ts                          # Groq API + grounding prompt
│
├── components/
│   ├── ChatWindow.tsx                  # Chat messages display
│   ├── ChatInput.tsx                   # Question input + debug toggle
│   ├── CitationCard.tsx                # Per-answer citations display
│   ├── ChunkDebugPanel.tsx             # Raw chunks viewer (debug mode)
│   └── StatusBadge.tsx                 # Index health indicator
│
├── data/
│   ├── pdfs/                           # Aviation PDFs go here
│   └── index/                         # Vectra saved index files
│       ├── vectors.json               # Stored vectors
│       └── chunks.json               # Chunk text + metadata
│
├── evaluation/
│   ├── questions.json                  # 50 evaluation questions
│   └── report.md                       # Generated evaluation report
│
├── scripts/
│   └── evaluate.ts                     # Evaluation runner
│
├── .env.example
├── .env.local
├── README.md
└── package.json
```

---

## All Functionality — Detailed

---

### 1. PDF Ingestion Pipeline

**Triggered by:** `POST /api/ingest` or "Ingest Documents" button on UI

**Step 1 — PDF Loading**

* `pdfjs-dist` opens every PDF inside `data/pdfs/`
* Reads text from every single page
* Preserves which page each piece of text came from
* Cleans up common PDF artifacts:
  * Extra whitespace and line breaks
  * Broken words from hyphenation
  * Repeated headers and footers
  * Page number artifacts

**Step 2 — Text Chunking**

* Chunk size: **500 tokens**
* Overlap: **50 tokens**
* Splits on paragraph or sentence boundaries — never mid-sentence
* Each chunk stored with full metadata:

```
{
  chunk_id: "ppl_textbook_pg42_c003",
  doc_name: "ppl_textbook.pdf",
  page_number: 42,
  text: "...the actual chunk text..."
}
```

**Why 500 tokens, 50 overlap:**
Aviation content is dense with procedures and regulations. 500 tokens keeps a full procedure together without splitting it. 50-token overlap ensures answers that sit at chunk boundaries are still retrievable.

**Step 3 — Embedding Generation**

* Each chunk's text sent to local `Transformers.js` model (`Xenova/all-MiniLM-L6-v2`)
* Returns a 384-dimensional vector per chunk
* Represents the semantic meaning of that chunk (Runs fully locally, no API limits)

**Step 4 — Storing in Vectra**

* Vector + metadata saved into Vectra local index
* Persisted to disk at `data/index/`
* Survives server restarts — no need to re-ingest every time
* Returns total chunks indexed on completion

---

### 2. Query → Retrieval → Answer Pipeline

**Triggered by:** `POST /api/ask`

**Step 1 — Embed the Question**

* User's question sent to local `Transformers.js` model (`Xenova/all-MiniLM-L6-v2`)
* Returns a 384-dimensional vector

**Step 2 — Vector Search (Vectra)**

* Query vector compared against all stored chunk vectors
* Uses cosine similarity
* Returns top 5 most semantically relevant chunks with similarity scores

**Step 3 — BM25 Search (Level 2)**

* Same question run through BM25 keyword index
* Returns top 10 keyword-matched chunks
* Catches exact term matches that vector search might miss
* Example: "V1 speed" — BM25 catches exact term, vector might generalize

**Step 4 — Merge + Rerank (Level 2)**

* Vector top 5 + BM25 top 10 merged together
* Duplicates removed
* Each candidate scored against the question for relevance (1–10)
* Top 5 after reranking passed to LLM

**Step 5 — Grounding Prompt to Groq**

The prompt sent to `llama-3.3-70b-versatile`:

```
SYSTEM:
You are an aviation assistant. You must answer ONLY using 
the context provided below. Do not use any outside knowledge 
whatsoever. If the answer cannot be found in the context, 
respond with exactly this phrase and nothing else:
"This information is not available in the provided document(s)."

CONTEXT:
[Chunk 1 — ppl_textbook.pdf, Page 42]
...text...

[Chunk 2 — ppl_textbook.pdf, Page 67]
...text...

[Chunk 3 — atpl_manual.pdf, Page 112]
...text...

USER QUESTION:
{user's question}
```

**Step 6 — Response Assembly**

* Answer text from Groq
* Citations array built from which chunks were used
* Retrieved chunks included if debug mode is on
* `refused` boolean flagged if refusal phrase detected

---

### 3. Hallucination Control

**This is the most critical part of the system.**

**How it's enforced — 3 layers:**

**Layer 1 — System Prompt**

* Groq explicitly told: answer only from context, no outside knowledge
* Exact refusal phrase given — model must output it verbatim if unsure

**Layer 2 — API Route Check**

* After Groq responds, the API route checks if response contains the refusal phrase
* If yes → sets `refused: true` in the response
* Frontend displays it with a warning style

**Layer 3 — Evaluation**

* During evaluation, answers are checked against retrieved chunks
* Any fact in the answer not traceable to a chunk = hallucination
* Counted and reported

---

### 4. API Endpoints — Full Specification

---

**POST /api/ingest**

Input:

```json
{}
```

(Automatically loads all PDFs from `data/pdfs/`)

Output:

```json
{
  "status": "success",
  "chunks_indexed": 342,
  "documents_processed": ["ppl_textbook.pdf", "atpl_manual.pdf"]
}
```

---

**POST /api/ask**

Input:

```json
{
  "question": "What is the minimum visibility for VFR flight?",
  "debug": true
}
```

Output:

```json
{
  "answer": "The minimum visibility for VFR flight is...",
  "citations": [
    {
      "doc_name": "ppl_textbook.pdf",
      "page_number": 42,
      "chunk_id": "ppl_textbook_pg42_c003"
    }
  ],
  "retrieved_chunks": [
    {
      "chunk_id": "ppl_textbook_pg42_c003",
      "doc_name": "ppl_textbook.pdf",
      "page_number": 42,
      "text": "...raw chunk text...",
      "similarity_score": 0.91
    }
  ],
  "refused": false,
  "debug": true
}
```

When `debug: false`, `retrieved_chunks` is omitted from response.

---

**GET /api/health**

Output:

```json
{
  "status": "ok",
  "index_loaded": true,
  "chunks_count": 342,
  "documents": ["ppl_textbook.pdf", "atpl_manual.pdf"]
}
```

---

### 5. Frontend Chat UI

**Single page application at `/`**

---

**StatusBadge (top of page)**

* Shows index status: ✅ Index Loaded (342 chunks) or ❌ Index Not Loaded
* "Ingest Documents" button — triggers `/api/ingest`
* Shows loading spinner during ingestion
* Shows which documents are loaded

**ChatWindow**

* Scrollable conversation history
* User messages — right aligned, blue
* AI answers — left aligned, white/gray
* Refused answers — amber/warning colored with an icon
* Each AI message has a citations section below it
* Smooth scroll to latest message

**CitationCard (inside each AI message)**

* Shows: 📄 `ppl_textbook.pdf` — Page 42
* One card per citation
* Clean, compact design

**ChunkDebugPanel (only when debug mode on)**

* Expandable panel below the answer
* Shows top 3–5 retrieved chunks
* Shows chunk text, document, page, similarity score
* Useful for understanding why an answer was given

**ChatInput (bottom of page)**

* Text input field
* Send button
* Debug mode toggle switch
* Disabled + shows spinner while answer loading
* Pressing Enter sends the message

---

### 6. Evaluation System

---

**questions.json — 50 Questions**

**20 Factual Questions (direct lookups):**

* What is the definition of VMC?
* What does METAR stand for?
* What is the standard pressure setting in aviation?
* Define the term "Decision Altitude"
* What are the classes of airspace?
* *(and 15 more like these)*

**20 Applied Questions (scenario-based):**

* A pilot is flying VFR at night with 2km visibility. Is this legal and what are the requirements?
* During engine failure after takeoff below 1000ft, what is the correct procedure?
* A student pilot encounters unexpected IMC. What immediate actions should be taken?
* *(and 17 more like these)*

**10 Higher-Order Reasoning Questions (multi-step):**

* Compare VFR and IFR fuel requirements and explain the safety reasoning behind the difference
* If a SIGMET and a pilot report contradict each other, which takes priority and why?
* Explain how a pressure altimeter can give incorrect readings and what a pilot should do in each scenario
* *(and 7 more like these)*

---

**evaluate.ts Script — What it does:**

1. Loads all 50 questions from `questions.json`
2. Sends each question to `POST /api/ask` with `debug: true`
3. Waits for response, stores everything
4. Calculates all metrics
5. Generates `evaluation/report.md`

---

**Metrics Calculated:**

| Metric             | How It's Measured                                               |
| ------------------ | --------------------------------------------------------------- |
| Retrieval Hit-Rate | % of questions where retrieved chunks contained answer keywords |
| Faithfulness Score | % of answers where every claim traces back to a retrieved chunk |
| Hallucination Rate | % of answers containing facts not in retrieved chunks           |
| Refusal Accuracy   | % of unanswerable questions correctly refused                   |
| Answer Rate        | % of answerable questions that got a real answer                |

---

**report.md Structure:**

* Executive summary
* Metrics table
* 5 best answers — what question, what answer, why it's good
* 5 worst answers — what question, what answer, what went wrong
* Observations about retrieval quality
* Recommendations for improvement

---

### 7. Level 2 — Hybrid Retrieval (BM25 + Vector + Reranker)

**Built into the same system, not separate.**

**BM25 Index (`lib/bm25.ts`)**

* Built from all chunks during ingestion
* Saved alongside Vectra index
* `wink-bm25-text-search` library
* Handles exact term matching

**Retrieval Flow Change:**

* Level 1: Vector search only → top 5 chunks
* Level 2: Vector top 5 + BM25 top 10 → merge → rerank → top 5

**Reranker (`lib/reranker.ts`)**

* Takes all merged candidates
* Scores each against the original question
* Uses a relevance scoring prompt sent to Groq
* Sorts by score, picks top 5
* These top 5 go to the final LLM call

**Metrics Comparison in Report:**

* Level 1 retrieval hit-rate vs Level 2 retrieval hit-rate
* Shows concrete improvement numbers

---

## Complete Data Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INGESTION FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

data/pdfs/*.pdf
    ↓
pdfjs-dist (extract text per page)
    ↓
Chunker (500 tokens, 50 overlap)
    ↓
Transformers.js all-MiniLM-L6-v2 (384-dim local vectors)
    ↓
Vectra (save vectors to disk)
    +
BM25 Index (save keyword index to disk)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUERY FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User Question (Chat UI)
    ↓
POST /api/ask
    ↓
Transformers.js all-MiniLM-L6-v2 (embed question locally)
    ↓
Vectra Search → Top 5 semantic chunks
    +
BM25 Search  → Top 10 keyword chunks    [Level 2]
    ↓
Merge + Deduplicate                      [Level 2]
    ↓
Reranker (Groq scores relevance)         [Level 2]
    ↓
Top 5 Final Chunks
    ↓
Groq llama-3.3-70b (strict grounding prompt)
    ↓
Answer + Citations + Refused flag
    ↓
Chat UI (render answer, citations, debug panel)
```

---

## Build Order

| Step | What                                           |
| ---- | ---------------------------------------------- |
| 1    | Next.js setup + install all dependencies       |
| 2    | PDF parser — load PDFs, extract text per page |
| 3    | Chunker — split text, attach metadata         |
| 4    | Transformers.js embeddings — encode chunks, get local vectors  |
| 5    | Vectra store — save + load index from disk    |
| 6    | `/api/ingest`— wire steps 2–5 together     |
| 7    | Groq LLM — grounding prompt + refusal logic   |
| 8    | `/api/ask`— full RAG pipeline               |
| 9    | `/api/health`— index status                 |
| 10   | Chat UI — ChatWindow, ChatInput, CitationCard |
| 11   | Debug panel — ChunkDebugPanel                 |
| 12   | Write 50 questions in `questions.json`       |
| 13   | Build `evaluate.ts`+ run evaluation          |
| 14   | Write `report.md`                            |
| 15   | Add BM25 + reranker (Level 2)                  |
| 16   | Update metrics in report                       |
| 17   | Write README with setup steps                  |
| 18   | Record 5–8 min demo video                     |

---

## What Makes This Submission Strong

* ✅ Zero hallucinations — enforced at 3 levels
* ✅ Page-level citations — every answer traceable
* ✅ Debug mode — full retrieval transparency
* ✅ Hybrid retrieval — BM25 + vector + reranker
* ✅ Measurable evaluation — numbers not just opinions
* ✅ Single clean repo — no separate backend
* ✅ Completely free — Groq API + Local Transformers.js
* ✅ Fast responses — Groq is the fastest free LLM API
