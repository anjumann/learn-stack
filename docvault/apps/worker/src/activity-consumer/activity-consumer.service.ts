import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Counter } from 'prom-client';
import { SqsService } from '@docvault/aws';
import { SnsDocumentEvent } from '@docvault/types';
import { ActivityLog } from '../shared/activity-log.entity';

const messagesProcessed = new Counter({
  name: 'activity_messages_processed_total',
  help: 'Total activity queue messages processed',
  labelNames: ['status'],
});

@Injectable()
export class ActivityConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ActivityConsumerService.name);
  private readonly sqs = new SqsService();
  private readonly queueUrl: string;
  private isRunning = false;

  constructor(
    @InjectRepository(ActivityLog)
    private readonly repo: Repository<ActivityLog>,
    config: ConfigService,
  ) {
    this.queueUrl = config.get('SQS_ACTIVITY_QUEUE_URL', '');
  }

  onModuleInit() {
    this.isRunning = true;
    void this.poll();
  }

  private async poll() {
    this.logger.log('ActivityConsumer polling started');
    while (this.isRunning) {
      try {
        const messages = await this.sqs.receive(this.queueUrl, { maxMessages: 10 });
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
      // SNS envelope: { Type: "Notification", Message: "...", MessageAttributes: {...} }
      const envelope = JSON.parse(body);
      const event: SnsDocumentEvent = JSON.parse(envelope.Message ?? body);

      const log = this.repo.create({
        eventType: event.eventType,
        documentId: event.documentId,
        filename: event.filename,
      });
      await this.repo.save(log);

      this.logger.log(`Activity logged: ${event.eventType} for ${event.filename}`);
      await this.sqs.delete(this.queueUrl, receiptHandle);
      messagesProcessed.labels('success').inc();
    } catch (err) {
      messagesProcessed.labels('failure').inc();
      this.logger.error('Activity write failed (will retry):', err);
    }
  }
}
