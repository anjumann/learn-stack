import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Counter } from 'prom-client';
import { SqsService } from '@docvault/aws';
import { SnsDocumentEvent } from '@docvault/types';

const emailsSent = new Counter({
  name: 'emails_sent_total',
  help: 'Total emails sent via Resend',
  labelNames: ['event_type', 'status'],
});

@Injectable()
export class EmailConsumerService implements OnModuleInit {
  private readonly logger = new Logger(EmailConsumerService.name);
  private readonly sqs = new SqsService();
  private readonly resend: Resend;
  private readonly from: string;
  private readonly to: string;
  private readonly queueUrl: string;
  private isRunning = false;

  constructor(config: ConfigService) {
    this.resend = new Resend(config.get('RESEND_API_KEY'));
    this.from = config.get('NOTIFICATION_EMAIL_FROM', 'docvault@example.com');
    this.to = config.get('NOTIFICATION_EMAIL_TO', '');
    this.queueUrl = config.get('SQS_EMAIL_QUEUE_URL', '');
  }

  onModuleInit() {
    if (!this.to) {
      this.logger.warn('NOTIFICATION_EMAIL_TO not set — email notifications disabled');
      return;
    }
    this.isRunning = true;
    void this.poll();
  }

  private async poll() {
    this.logger.log('EmailConsumer polling started');
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

      const { subject, html } = this.buildEmail(event);

      const { error } = await this.resend.emails.send({
        from: this.from,
        to: this.to,
        subject,
        html,
      });

      if (error) {
        throw new Error(`Resend error: ${error.message}`);
      }

      this.logger.log(`Email sent for ${event.eventType}: ${event.filename}`);
      await this.sqs.delete(this.queueUrl, receiptHandle);
      emailsSent.labels(event.eventType, 'success').inc();
    } catch (err) {
      emailsSent.labels('unknown', 'failure').inc();
      this.logger.error('Email send failed (will retry):', err);
    }
  }

  private buildEmail(event: SnsDocumentEvent): { subject: string; html: string } {
    switch (event.eventType) {
      case 'document.indexed':
        return {
          subject: `DocVault: "${event.filename}" is ready to search`,
          html: `
            <h2>Document indexed successfully</h2>
            <p>Your document <strong>${event.filename}</strong> has been processed and is ready to search.</p>
            <p>Open DocVault to start searching your document.</p>
          `,
        };
      case 'document.failed':
        return {
          subject: `DocVault: Indexing failed for "${event.filename}"`,
          html: `
            <h2>Document indexing failed</h2>
            <p>We encountered an issue processing <strong>${event.filename}</strong>.</p>
            <p>The document may be a scanned PDF or in an unsupported format.</p>
          `,
        };
      case 'document.deleted':
        return {
          subject: `DocVault: "${event.filename}" has been deleted`,
          html: `
            <h2>Document deleted</h2>
            <p><strong>${event.filename}</strong> has been permanently removed from DocVault.</p>
          `,
        };
      default:
        return {
          subject: `DocVault: Document update for "${event.filename}"`,
          html: `<p>Event: ${event.eventType} for document ${event.filename}</p>`,
        };
    }
  }
}
