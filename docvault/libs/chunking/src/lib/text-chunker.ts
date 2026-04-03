export class TextChunker {
  /**
   * Split text into fixed-size chunks with overlap.
   *
   * Why overlap? Sentences near a chunk boundary end up split across two chunks.
   * By repeating the last `overlap` characters at the start of the next chunk,
   * each semantic unit stays intact in at least one chunk — improving recall.
   *
   * Rule of thumb: 1 token ≈ 4 chars (English prose)
   *   - chunkSize 2000 chars ≈ 512 tokens
   *   - overlap   256  chars ≈ 64  tokens
   */
  chunk(
    text: string,
    chunkSize = 2000,
    overlap = 256
  ): string[] {
    if (!text) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      if (end >= text.length) break;
      // Advance by (chunkSize - overlap) so the next chunk shares `overlap` chars
      start += chunkSize - overlap;
    }

    return chunks;
  }
}
