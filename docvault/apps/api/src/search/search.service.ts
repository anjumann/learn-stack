import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Counter, Histogram } from 'prom-client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { SearchRequestDto, SearchResultDto, ChunkDto } from '@docvault/types';
import { Document, DocumentDocument } from '../documents/document.entity';

const searchCounter = new Counter({
  name: 'search_requests_total',
  help: 'Total semantic search requests',
});

const searchDuration = new Histogram({
  name: 'search_duration_seconds',
  help: 'End-to-end search latency in seconds',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

@Injectable()
export class SearchService {
  private readonly qdrant: QdrantClient;
  private readonly infinityUrl: string;
  private readonly infinityModel: string;

  constructor(
    @InjectModel(Document.name)
    private readonly docModel: Model<DocumentDocument>,
    config: ConfigService,
  ) {
    this.qdrant = new QdrantClient({ url: config.get('QDRANT_URL') });
    this.infinityUrl = config.get('INFINITY_URL', 'http://localhost:7997');
    this.infinityModel = config.get('INFINITY_MODEL', 'BAAI/bge-small-en-v1.5');
  }

  async search(dto: SearchRequestDto): Promise<SearchResultDto> {
    const end = searchDuration.startTimer();
    searchCounter.inc();

    try {
      // 1. Embed the query via Infinity
      const queryVector = await this.embedQuery(dto.query);

      // 2. Search Qdrant for nearest chunks
      const results = await this.qdrant.search('document_chunks', {
        vector: queryVector,
        limit: dto.topK ?? 5,
        with_payload: true,
      });

      // 3. Enrich with document metadata from MongoDB
      const documentIds = [
        ...new Set(results.map((r) => r.payload?.['documentId'] as string).filter(Boolean)),
      ];
      const docs = await this.docModel.find({ _id: { $in: documentIds } });
      const docMap = new Map(docs.map((d) => [d.id, d]));

      const chunks: ChunkDto[] = results.map((r) => {
        const payload = r.payload ?? {};
        const doc = docMap.get(payload['documentId'] as string);
        return {
          text: payload['text'] as string,
          score: r.score,
          documentId: payload['documentId'] as string,
          filename: doc?.filename ?? payload['filename'] as string,
          chunkIndex: payload['chunkIndex'] as number,
        };
      });

      return { query: dto.query, chunks };
    } finally {
      end();
    }
  }

  private async embedQuery(text: string): Promise<number[]> {
    const response = await fetch(`${this.infinityUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.infinityModel, input: [text] }),
    });

    if (!response.ok) {
      throw new Error(`Infinity embedding failed: ${response.status}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }
}
