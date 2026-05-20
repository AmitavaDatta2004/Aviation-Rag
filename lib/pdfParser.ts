import * as fs from 'fs';
import * as path from 'path';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker to run in single-thread Node.js server side environment
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // @ts-ignore
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;
}

export interface PDFPageData {
  docName: string;
  pageNumber: number;
  text: string;
}

export async function parsePDF(filePath: string): Promise<PDFPageData[]> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const docName = path.basename(filePath);
  const pages: PDFPageData[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Join text items
    let text = items.map(item => item.str).join(' ');

    // Basic cleaning: collapse whitespace, fix hyphens
    text = cleanPDFText(text);

    pages.push({
      docName,
      pageNumber: i,
      text,
    });
  }

  return pages;
}

function cleanPDFText(text: string): string {
  return text
    .replace(/\s+/g, ' ')        // Collapse multiple spaces/tabs
    .replace(/-\s+/g, '')        // Rejoin hyphenated words split across lines
    .replace(/[\r\n]+/g, ' ')    // Remove carriage returns/newlines
    .trim();
}
