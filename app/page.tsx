'use client';

import React, { useState, useEffect } from 'react';
import { Compass, BookOpen, ShieldAlert, Sparkles, Terminal } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import ChatWindow, { ChatMessage } from '@/components/ChatWindow';
import ChatInput from '@/components/ChatInput';

export default function Home() {
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [chunksCount, setChunksCount] = useState(0);
  const [documents, setDocuments] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load system health on mount
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setIndexLoaded(data.index_loaded);
        setChunksCount(data.chunks_count);
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error('Failed to query system health:', e);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Handle PDF Ingestion
  const handleIngest = async () => {
    setIsIngesting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ingest', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok && data.status === 'success') {
        await checkHealth();
      } else {
        setErrorMsg(data.message || 'Ingestion failed.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Network error during ingestion.');
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle Query transmission
  const handleSend = async (question: string, debug: boolean) => {
    setIsLoading(true);
    setErrorMsg(null);

    // Add user message to history immediately
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, debug }),
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          retrieved_chunks: data.retrieved_chunks,
          refused: data.refused,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setErrorMsg(data.message || 'An error occurred during query processing.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Network error while reaching ask API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-riso-paper text-riso-ink flex flex-col relative">
      {/* Paper grain overlay */}
      <div className="grain-overlay" />

      {/* Riso Ink Header */}
      <header className="bg-riso-ink text-riso-paper py-4 px-6 riso-border-b shadow-riso relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-riso-pink border border-riso-paper flex items-center justify-center rotate-[-4deg]">
            <Compass size={16} className="text-riso-paper" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase">
              AIRMAN // FLIGHT DOC AI CHAT
            </h1>
            <p className="text-[9px] uppercase tracking-wider text-riso-paper/60 font-mono">
              Hybrid Vector + BM25 RAG Grounded System
            </p>
          </div>
        </div>
        <div className="text-[10px] bg-riso-blue text-riso-paper px-2 py-0.5 font-mono uppercase tracking-wider border border-riso-paper font-bold">
          SECURITY LEVEL: UNCLASSIFIED
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Side: Technical Info & Document Health Panel */}
        <section className="lg:col-span-4 flex flex-col space-y-6">
          {/* Status Badge Widget */}
          <StatusBadge
            indexLoaded={indexLoaded}
            chunksCount={chunksCount}
            documents={documents}
            isIngesting={isIngesting}
            onIngest={handleIngest}
          />

          {/* Hallucination Safety Manual Card */}
          <div className="bg-riso-paper border-2 border-riso-ink p-4 shadow-riso relative">
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-riso-yellow border border-riso-ink" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-riso-ink mb-3 flex items-center gap-2">
              <ShieldAlert size={14} className="text-riso-pink" /> 
              HALLUCINATION SAFEGUARD PROTOCOL
            </h2>
            <div className="space-y-2.5 text-xxs font-mono leading-relaxed text-riso-ink/80">
              <p>
                <strong className="text-riso-ink bg-riso-yellow/40 px-1">L1 — PROMPT ENFORCEMENT:</strong> Groq LLM is explicitly forbidden from employing pre-existing weights or outside aircraft datasets.
              </p>
              <p>
                <strong className="text-riso-ink bg-riso-teal/20 px-1">L2 — REFUSAL FILTERING:</strong> Responses matching exclusion metrics trigger the 
                <span className="text-riso-pink font-bold"> DATABASE EXCLUSION WARNING</span> state and block citation creation.
              </p>
              <p>
                <strong className="text-riso-ink bg-riso-blue/10 px-1">L3 — COMPACT VERIFICATION:</strong> Run the evaluation script via command line to test accuracy benchmarks across 50 scenario matrices.
              </p>
            </div>
          </div>

          {/* System Instructions / Operation Details */}
          <div className="bg-riso-gray/40 border border-riso-ink border-dashed p-4 text-[10px] font-mono leading-relaxed text-riso-ink/75">
            <div className="flex items-center gap-1.5 font-bold uppercase text-riso-ink mb-1.5">
              <BookOpen size={12} className="text-riso-blue" />
              <span>OPERATOR INSTRUCTIONS</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Upload aviation textbook files (.pdf) directly to <code className="bg-riso-gray px-1 text-xxs">data/pdfs/</code>.</li>
              <li>Click the "Ingest PDF Documents" panel trigger to build indexes.</li>
              <li>Toggle <code className="bg-riso-gray px-1 text-xxs">DEBUG: ON</code> to audit similarity matrices in real-time.</li>
            </ol>
          </div>
        </section>

        {/* Right Side: Chat Window Interface */}
        <section className="lg:col-span-8 flex flex-col h-full justify-between">
          {/* Error notification */}
          {errorMsg && (
            <div className="bg-riso-pink text-riso-paper border-2 border-riso-ink p-3 mb-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-riso-sm animate-pop-in">
              <Terminal size={14} />
              <span>ERROR CODE: {errorMsg}</span>
            </div>
          )}

          {/* Timeline */}
          <ChatWindow messages={messages} isLoading={isLoading} />

          {/* Input Controls */}
          <ChatInput onSend={handleSend} disabled={isLoading || isIngesting} />
        </section>

      </main>

      {/* Footer stamp */}
      <footer className="text-center py-4 border-t border-riso-ink bg-riso-gray/50 text-[9px] font-mono uppercase tracking-widest text-riso-ink/50 mt-8">
        AIRMAN FLIGHT AI SEARCH SYSTEM // BUILT WITH NEXT.JS 15 + VECTRA + GROQ
      </footer>
    </div>
  );
}
