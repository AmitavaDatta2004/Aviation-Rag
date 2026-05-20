import React from 'react';
import { File } from 'lucide-react';

export interface Citation {
  doc_name: string;
  page_number: number;
  chunk_id: string;
}

interface CitationCardProps {
  citation: Citation;
}

export default function CitationCard({ citation }: CitationCardProps) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-riso-paper border border-riso-ink px-2 py-0.5 text-xxs font-bold shadow-riso-sm hover:bg-riso-yellow hover:-translate-y-0.5 hover:shadow-riso transition-all mr-2 mb-2 cursor-help">
      <File size={10} className="text-riso-pink flex-shrink-0" />
      <span className="truncate max-w-[140px] text-riso-ink" title={citation.doc_name}>
        {citation.doc_name}
      </span>
      <span className="bg-riso-blue text-riso-paper px-1 text-[9px] uppercase tracking-wider font-bold">
        P. {citation.page_number}
      </span>
    </div>
  );
}
