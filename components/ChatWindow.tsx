'use client';

import React, { useEffect, useRef } from 'react';
import { MessageSquare, AlertOctagon, Sparkles } from 'lucide-react';
import CitationCard, { Citation } from './CitationCard';
import ChunkDebugPanel, { RetrievedChunk } from './ChunkDebugPanel';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  retrieved_chunks?: RetrievedChunk[];
  refused?: boolean;
}

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto riso-border bg-riso-paper p-4 space-y-6 max-h-[60vh] min-h-[40vh] shadow-riso-lg relative">
      {/* Background Grid Pattern to enforce the dense print aesthetic */}
      <div className="absolute inset-0 bg-[radial-gradient(#111111_1px,transparent_1px)] [background-size:16px_16px] opacity-5 pointer-events-none" />

      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 relative z-10">
          <div className="w-12 h-12 bg-riso-blue border-2 border-riso-ink flex items-center justify-center shadow-riso mb-4 rotate-[-3deg] text-riso-paper">
            <MessageSquare size={24} />
          </div>
          <h3 className="font-bold text-sm uppercase tracking-wider text-riso-ink mb-2">
            AIRMAN FLIGHT MANUAL DATABASE
          </h3>
          <p className="text-xs text-riso-ink/65 max-w-sm leading-relaxed font-mono">
            Ask any question regarding aviation procedures, meteorological symbols, VFR limits, and document details. 
            All responses are strictly grounded in indexed PDFs.
          </p>
        </div>
      ) : (
        <div className="space-y-6 relative z-10">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            
            return (
              <div
                key={message.id}
                className={`flex flex-col max-w-[85%] ${
                  isUser ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                {/* Bubble Container */}
                <div
                  className={`p-4 riso-border ${
                    isUser
                      ? 'bg-riso-blue text-riso-paper shadow-riso-pink animate-pop-in'
                      : message.refused
                      ? 'bg-riso-pink text-riso-paper shadow-riso-lg animate-pop-in'
                      : 'bg-riso-gray text-riso-ink shadow-riso animate-pop-in'
                  }`}
                >
                  {/* Sender Header */}
                  <div
                    className={`text-[9px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b pb-1.5 ${
                      isUser
                        ? 'text-riso-paper/70 border-riso-paper/20'
                        : message.refused
                        ? 'text-riso-paper/70 border-riso-paper/20'
                        : 'text-riso-ink/60 border-riso-ink/10'
                    }`}
                  >
                    {isUser ? (
                      'PILOT IN COMMAND'
                    ) : message.refused ? (
                      <span className="flex items-center gap-1">
                        <AlertOctagon size={10} /> DATABASE EXCLUSION WARNING
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Sparkles size={10} className="text-riso-pink" /> AIRMAN FLIGHT CO-PILOT
                      </span>
                    )}
                  </div>

                  {/* Body Text */}
                  <p className="text-xs leading-relaxed font-mono whitespace-pre-line">
                    {message.content}
                  </p>

                  {/* Citations block for assistant answers */}
                  {!isUser && message.citations && message.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-dashed border-riso-ink/20">
                      <div className="text-[8px] font-bold uppercase tracking-wider text-riso-ink/60 mb-1.5">
                        Document Citations:
                      </div>
                      <div className="flex flex-wrap">
                        {message.citations.map((citation, i) => (
                          <CitationCard key={i} citation={citation} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Retrieved chunks debug panel */}
                {!isUser && message.retrieved_chunks && message.retrieved_chunks.length > 0 && (
                  <div className="w-full">
                    <ChunkDebugPanel chunks={message.retrieved_chunks} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="mr-auto max-w-[80%] flex flex-col items-start relative z-10 animate-pulse">
          <div className="bg-riso-yellow text-riso-ink border-2 border-riso-ink p-3 shadow-riso">
            <div className="text-[9px] font-bold uppercase tracking-wider text-riso-ink/60 mb-1 border-b border-riso-ink/10 pb-1 flex items-center gap-1.5">
              <RefreshCw size={10} className="animate-spin text-riso-pink" /> 
              SEARCHING, HYBRID DEDUPLICATING & RERANKING
            </div>
            <div className="flex gap-1 items-center py-2">
              <span className="h-1.5 w-1.5 bg-riso-ink rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-1.5 w-1.5 bg-riso-ink rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-1.5 w-1.5 bg-riso-ink rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

// Small helper inline definition to support the spinning icon inside the loading badge
import { RefreshCw } from 'lucide-react';
