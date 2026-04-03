import { TextChunker } from './text-chunker';

describe('TextChunker', () => {
  const chunker = new TextChunker();

  it('returns empty array for empty string', () => {
    expect(chunker.chunk('')).toEqual([]);
  });

  it('returns single chunk when text is shorter than chunkSize', () => {
    const text = 'Hello world';
    const result = chunker.chunk(text, 2000, 256);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it('returns single chunk when text is exactly chunkSize', () => {
    const text = 'a'.repeat(2000);
    const result = chunker.chunk(text, 2000, 256);
    expect(result).toHaveLength(1);
  });

  it('splits text into multiple chunks', () => {
    // 4000 chars with no overlap should produce 2 chunks
    const text = 'a'.repeat(4000);
    const result = chunker.chunk(text, 2000, 0);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2000);
    expect(result[1]).toHaveLength(2000);
  });

  it('adds overlap between chunks', () => {
    // Chunk 0: chars 0–1999 (all 'a')
    // With overlap=256, chunk 1 starts at char 1744 (last 256 'a's of chunk 0)
    const text = 'a'.repeat(2000) + 'b'.repeat(2000);
    const result = chunker.chunk(text, 2000, 256);
    // Second chunk starts with the last 256 chars of the first chunk ('a's)
    expect(result[1].startsWith('a'.repeat(256))).toBe(true);
    // Then continues with 'b's
    expect(result[1].slice(256).startsWith('b')).toBe(true);
  });

  it('handles text slightly larger than chunkSize', () => {
    const text = 'x'.repeat(2001);
    const result = chunker.chunk(text, 2000, 0);
    expect(result).toHaveLength(2);
    expect(result[1]).toHaveLength(1);
  });

  it('trims whitespace from chunks', () => {
    const text = '  hello world  ';
    const result = chunker.chunk(text);
    expect(result[0]).toBe('hello world');
  });

  it('skips chunks that are empty after trimming', () => {
    const text = 'a'.repeat(2000) + '   ' + 'b'.repeat(2000);
    const result = chunker.chunk(text, 2000, 0);
    // All chunks should have content after trim
    result.forEach((chunk) => expect(chunk.trim().length).toBeGreaterThan(0));
  });
});
