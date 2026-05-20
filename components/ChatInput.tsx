'use client';

import React, { useState } from 'react';
import { Send, Eye, EyeOff } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string, debug: boolean) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [debug, setDebug] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim(), debug);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Main Text Input */}
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled 
                ? 'System busy...' 
                : 'Enter query (e.g. "What is the standard pressure setting?")'
            }
            rows={2}
            className="w-full riso-border bg-riso-paper text-riso-ink p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-riso-blue shadow-riso-sm resize-none disabled:bg-riso-darkgray/30"
          />
        </div>

        {/* Action Controls */}
        <div className="flex sm:flex-col gap-2 justify-between sm:justify-start">
          {/* Debug Toggle Button */}
          <button
            type="button"
            onClick={() => setDebug(!debug)}
            disabled={disabled}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-riso-ink text-xxs font-bold uppercase tracking-wider transition-all select-none shadow-riso-sm ${
              debug
                ? 'bg-riso-pink text-riso-paper shadow-none translate-x-[2px] translate-y-[2px]'
                : 'bg-riso-paper text-riso-ink hover:bg-riso-gray'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Toggle displaying parsed PDF text chunks and scores"
          >
            {debug ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{debug ? 'DEBUG: ON' : 'DEBUG: OFF'}</span>
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-riso-ink font-bold text-xs uppercase transition-all shadow-riso-sm ${
              !text.trim() || disabled
                ? 'bg-riso-darkgray text-riso-ink/40 cursor-not-allowed shadow-none translate-x-[2px] translate-y-[2px]'
                : 'bg-riso-blue text-riso-paper hover:bg-riso-yellow hover:text-riso-ink hover:shadow-riso active:translate-x-[2px] active:translate-y-[2px]'
            }`}
          >
            <Send size={12} />
            <span>Transmit</span>
          </button>
        </div>
      </div>
    </form>
  );
}
