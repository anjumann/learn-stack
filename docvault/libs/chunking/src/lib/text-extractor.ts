import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
// pdf-parse is CJS-only — use createRequire so it works under module:nodenext
const pdfParse = _require('pdf-parse') as (
  buffer: Buffer
) => Promise<{ text: string; numpages: number; numrender: number; info: unknown; metadata: unknown; version: string }>;
import { remark } from 'remark';
import stripMarkdown from 'strip-markdown';

/** Thrown when a PDF contains no extractable text (scanned / image-only). */
export class ScannedPdfError extends Error {
  constructor(message = 'PDF contains no extractable text (scanned or image-only)') {
    super(message);
    this.name = 'ScannedPdfError';
  }
}

export class TextExtractor {
  /**
   * Extract plain text from a PDF buffer via pdf-parse.
   *
   * pdf-parse wraps Mozilla's pdf.js — it reconstructs reading order from
   * glyph positions. Returns empty/whitespace-only text for scanned PDFs.
   */
  async extractFromPdf(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    const cleaned = this.cleanText(data.text);
    if (!cleaned) {
      throw new ScannedPdfError();
    }
    return cleaned;
  }

  /** Extract plain text from a Markdown buffer (strips MD syntax). */
  async extractFromMarkdown(buffer: Buffer): Promise<string> {
    const markdown = buffer.toString('utf-8');
    const file = await remark().use(stripMarkdown).process(markdown);
    return this.cleanText(file.toString());
  }

  /** Extract plain text from a plain-text buffer. */
  extractFromText(buffer: Buffer): string {
    return this.cleanText(buffer.toString('utf-8'));
  }

  /** Dispatch to the correct extractor based on MIME type. */
  async extract(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractFromPdf(buffer);
      case 'text/markdown':
      case 'text/x-markdown':
        return this.extractFromMarkdown(buffer);
      case 'text/plain':
        return this.extractFromText(buffer);
      default:
        throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  }

  private cleanText(raw: string): string {
    return raw
      .replace(/-\n/g, '')        // fix hyphenated line breaks
      .replace(/\s+/g, ' ')       // collapse all whitespace
      .replace(/\d+\s*\n/g, '')   // strip bare page numbers
      .trim();
  }
}
