import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Counter, Histogram } from 'prom-client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { S3Service, SqsService, SnsService } from '@docvault/aws';
import { TextExtractor, TextChunker, ScannedPdfError } from '@docvault/chunking';
import { SnsDocumentEvent } from '@docvault/types';
import { Document } from '../shared/document.entity';

const chunksCreatedCounter = new Counter({
  name: 'indexing_chunks_created_total',
  help: 'Total chunks created by the indexing pipeline',
});

const processingDuration = new Histogram({
  name: 'sqs_processing_duration_seconds',
  help: 'Time to process one SQS message',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 5, 10, 30],
});

const embeddingDuration = new Histogram({
  name: 'infinity_embed_duration_seconds',
  help: 'Infinity embedding inference latency',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2],
});

const qdrantDuration = new Histogram({
  name: 'qdrant_upsert_duration_seconds',
  help: 'Qdrant upsert latency',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5],
});

const messagesProcessed = new Counter({
  name: 'sqs_messages_processed_total',
  help: 'Total SQS messages processed',
  labelNames: ['queue', 'status'],
});

@Injectable()
export class IndexingConsumerService implements OnModuleInit {
  private readonly logger = new Logger(IndexingConsumerService.name);
  private readonly sqs = new SqsService();
  private readonly s3 = new S3Service();
  private readonly sns = new SnsService();
  private readonly extractor = new TextExtractor();
  private readonly chunker = new TextChunker();
  private readonly qdrant: QdrantClient;
  private readonly infinityUrl: string;
  private readonly infinityModel: string;
  private readonly queueUrl: string;
  private isRunning = false;

  constructor(
    @InjectRepository(Document)
    private readonly docRepo: Repository<Document>,
    config: ConfigService,
  ) {
    this.qdrant = new QdrantClient({ url: config.get('QDRANT_URL', 'http://localhost:6333') });
    this.infinityUrl = config.get('INFINITY_URL', 'http://localhost:7997');
    this.infinityModel = config.get('INFINITY_MODEL', 'BAAI/bge-small-en-v1.5');
    this.queueUrl = config.get('SQS_INDEXING_QUEUE_URL', '');
  }

  async onModuleInit() {
    await this.ensureQdrantCollection();
    this.isRunning = true;
    void this.poll();
  }

  /** Long-polling loop — runs for the lifetime of the worker process */
  private async poll() {
    this.logger.log('IndexingConsumer polling started');
    while (this.isRunning) {
      try {
        const messages = await this.sqs.receive(this.queueUrl, {
          maxMessages: 5,
          waitTimeSeconds: 20,
        });
        for (const msg of messages) {
          await this.processMessage(msg.Body!, msg.ReceiptHandle!);
        }
      } catch (err) {
        this.logger.error('Poll error (will retry):', err);
      }
    }
  }

  private async processMessage(body: string, receiptHandle: string) {
    const end = processingDuration.startTimer({ queue: 'indexing-queue' });
    try {
      // SNS wraps the message in an envelope
      const envelope = JSON.parse(body);
      const event: SnsDocumentEvent = JSON.parse(envelope.Message ?? body);

      this.logger.log(`Indexing document ${event.documentId} (${event.filename})`);

      // 1. Download file from S3
      const fileBuffer = await this.s3.download(event.s3Key);

      // 2. Extract text (ScannedPdfError = unindexable, don't retry)
      let text: string;
      try {
        text = await this.extractor.extract(fileBuffer, event.mimeType);
      } catch (err) {
        if (err instanceof ScannedPdfError) {
          this.logger.warn(`Scanned PDF — marking unindexable: ${event.documentId}`);
          await this.docRepo.update(event.documentId, { status: 'unindexable' });
          await this.sqs.delete(this.queueUrl, receiptHandle); // don't retry
          messagesProcessed.labels('indexing-queue', 'unindexable').inc();
          return;
        }
        throw err; // re-throw other errors → SQS will redeliver
      }

      // 3. Chunk the text
      const chunks = this.chunker.chunk(text);
      this.logger.log(`  Created ${chunks.length} chunks`);
      chunksCreatedCounter.inc(chunks.length);

      // 4. Embed all chunks via Infinity
      const embedEnd = embeddingDuration.startTimer();
      const vectors = await this.embedChunks(chunks);
      embedEnd();

      // 5. Upsert vectors to Qdrant
      const qdrantEnd = qdrantDuration.startTimer();
      const points = chunks.map((chunk, i) => ({
        id: uuidv4(),
        vector: vectors[i],
        payload: {
          documentId: event.documentId,
          chunkIndex: i,
          text: chunk,
          filename: event.filename,
          s3Key: event.s3Key,
        },
      }));
      await this.qdrant.upsert('document_chunks', { points, wait: true });
      qdrantEnd();

      // 6. Update Postgres status → indexed
      await this.docRepo.update(event.documentId, {
        status: 'indexed',
        chunkCount: chunks.length,
      });

      // 7. Delete SQS message (success path)
      await this.sqs.delete(this.queueUrl, receiptHandle);

      // 8. Publish document.indexed event → triggers email-queue
      const indexedEvent: SnsDocumentEvent = {
        eventType: 'document.indexed',
        documentId: event.documentId,
        s3Key: event.s3Key,
        filename: event.filename,
        mimeType: event.mimeType,
      };
      await this.sns.publish(
        indexedEvent as unknown as Record<string, unknown>,
        'document.indexed',
      );

      messagesProcessed.labels('indexing-queue', 'success').inc();
      this.logger.log(`  Indexed successfully: ${event.documentId}`);
    } catch (err) {
      // Do NOT delete the message → SQS visibility timeout expires → redelivered
      // After maxReceiveCount (3) failures, moves to indexing-dlq automatically
      messagesProcessed.labels('indexing-queue', 'failure').inc();
      this.logger.error(`Indexing failed (will retry via visibility timeout):`, err);
    } finally {
      end();
    }
  }

  private async embedChunks(chunks: string[]): Promise<number[][]> {
    const response = await fetch(`${this.infinityUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.infinityModel, input: chunks }),
    });
    if (!response.ok) {
      throw new Error(`Infinity embedding failed: ${response.status}`);
    }
    const data = await response.json() as { data: Array<{ embedding: number[]; index: number }> };
    // Reorder by index (Infinity may return out of order)
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  private async ensureQdrantCollection() {
    try {
      await this.qdrant.getCollection('document_chunks');
      this.logger.log('Qdrant collection document_chunks already exists');
    } catch {
      await this.qdrant.createCollection('document_chunks', {
        vectors: { size: 384, distance: 'Cosine' },
      });
      this.logger.log('Created Qdrant collection document_chunks (384-dim, Cosine)');
    }
  }
}
