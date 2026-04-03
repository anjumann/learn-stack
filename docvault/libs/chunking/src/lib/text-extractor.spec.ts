import { TextExtractor, ScannedPdfError } from './text-extractor';

// Mock pdf-parse so tests don't need a real PDF binary
jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock remark as a named export
jest.mock('remark', () => {
  const processor = {
    use: jest.fn().mockReturnThis(),
    process: jest.fn().mockResolvedValue({ toString: () => 'stripped markdown text' }),
  };
  return { remark: jest.fn(() => processor) };
});

// Mock strip-markdown (default export, no-op for mock)
jest.mock('strip-markdown', () => ({ default: jest.fn() }));

import pdfParse from 'pdf-parse';

describe('TextExtractor', () => {
  const extractor = new TextExtractor();
  const mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;

  beforeEach(() => jest.clearAllMocks());

  describe('extractFromPdf', () => {
    it('returns extracted text from PDF buffer', async () => {
      mockPdfParse.mockResolvedValue({
        text: '  Hello from PDF  ',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        version: '1.10.100',
      });

      const result = await extractor.extractFromPdf(Buffer.from('fake'));
      expect(result).toBe('Hello from PDF');
    });

    it('throws ScannedPdfError when pdf-parse returns empty text', async () => {
      mockPdfParse.mockResolvedValue({
        text: '   ',
        numpages: 2,
        numrender: 0,
        info: {},
        metadata: {},
        version: '1.10.100',
      });

      await expect(
        extractor.extractFromPdf(Buffer.from('scanned'))
      ).rejects.toThrow(ScannedPdfError);
    });
  });

  describe('extractFromText', () => {
    it('returns trimmed string from plain text buffer', () => {
      const buf = Buffer.from('  plain text content  ');
      expect(extractor.extractFromText(buf)).toBe('plain text content');
    });
  });

  describe('extract (dispatch by mimeType)', () => {
    it('dispatches to extractFromPdf for application/pdf', async () => {
      mockPdfParse.mockResolvedValue({
        text: 'pdf content',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: {},
        version: '1.10.100',
      });
      const result = await extractor.extract(Buffer.from('x'), 'application/pdf');
      expect(result).toBe('pdf content');
    });

    it('dispatches to extractFromText for text/plain', async () => {
      const result = await extractor.extract(Buffer.from('hello'), 'text/plain');
      expect(result).toBe('hello');
    });

    it('dispatches to extractFromMarkdown for text/markdown', async () => {
      const result = await extractor.extract(Buffer.from('# title'), 'text/markdown');
      expect(result).toBe('stripped markdown text');
    });

    it('throws for unsupported mime type', async () => {
      await expect(
        extractor.extract(Buffer.from('x'), 'image/png')
      ).rejects.toThrow('Unsupported mime type');
    });
  });
});
