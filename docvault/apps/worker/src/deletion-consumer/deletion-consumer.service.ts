import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Counter } from 'prom-client';
import { S3Service, SqsService } from '@docvault/aws';
import { SnsDocumentEvent } from '@docvault/types';
import { Document } from '../shared/document.entity';

const messagesProcessed = new Counter({
  name: 'deletion_messages_processed_total',
  help: 'Total deletion queue messages processed',
  labelNames: ['status'],
});

@Injectable()
export class DeletionConsumerService implements OnModuleInit {
  private readonly logger = new Logger(DeletionConsumerService.name);
  private readonly sqs = new SqsService();
  private readonly s3 = new S3Service();
  private readonly qdrant: QdrantClient;
  private readonly queueUrl: string;
  private isRunning = false;

  constructor(
    @InjectRepository(Document)
    private readonly docRepo: Repository<Document>,
    config: ConfigService,
  ) {
    this.qdrant = new QdrantClient({ url: config.get('QDRANT_URL', 'http://localhost:6333') });
    this.queueUrl = config.get('SQS_DELETION_QUEUE_URL', '');
  }

  onModuleInit() {
    this.isRunning = true;
    void this.poll();
  }

  private async poll() {
    this.logger.log('DeletionConsumer polling started');
    while (this.isRunning) {
      try {
        const messages = await this.sqs.receive(this.queueUrl, { maxMessages: 5 });
        for (const msg of messages) {
          await this.processMessage(msg.Body!, msg.ReceiptHandle!);
        }
      } catch (err) {
        this.logger.error('Poll error:', err);
      }
    }
  }

  private async processMessage(body: string, receiptHandle: string) {
    try {
      const envelope = JSON.parse(body);
      const event: SnsDocumentEvent = JSON.parse(envelope.Message ?? body);

      this.logger.log(`Deleting document ${event.documentId} (${event.filename})`);

      // 1. Delete all S3 versions
      await this.s3.deleteAllVersions(event.s3Key);
      this.logger.log(`  S3 versions deleted for key: ${event.s3Key}`);

      // 2. Delete all Qdrant vectors for this document
      await this.qdrant.delete('document_chunks', {
        filter: {
          must: [{ key: 'documentId', match: { value: event.documentId } }],
        },
        wait: true,
      });
      this.logger.log(`  Qdrant vectors deleted for documentId: ${event.documentId}`);

      // 3. Hard-delete Postgres record
      await this.docRepo.delete({ id: event.documentId });
      this.logger.log(`  Postgres record deleted: ${event.documentId}`);

      // 4. Acknowledge the message
      await this.sqs.delete(this.queueUrl, receiptHandle);
      messagesProcessed.labels('success').inc();
    } catch (err) {
      messagesProcessed.labels('failure').inc();
      this.logger.error('Deletion failed (will retry):', err);
    }
  }
}
