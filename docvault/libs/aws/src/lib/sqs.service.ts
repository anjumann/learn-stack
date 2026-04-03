import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';

function createSqsClient(): SQSClient {
  return new SQSClient({
    region: process.env['AWS_REGION'] ?? 'us-east-1',
    endpoint: process.env['AWS_ENDPOINT_URL'],
    credentials: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'test',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'test',
    },
  });
}

export class SqsService {
  private readonly client = createSqsClient();

  /**
   * Long-poll a queue for messages.
   *
   * SQS visibility timeout behaviour:
   * - While a message is being processed it is invisible to other consumers.
   * - If the worker crashes or does NOT call deleteMessage(), the message
   *   becomes visible again after the visibility timeout expires.
   * - After maxReceiveCount failures the message moves to the DLQ.
   */
  async receive(
    queueUrl: string,
    options: { maxMessages?: number; waitTimeSeconds?: number } = {}
  ): Promise<Message[]> {
    const result = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: options.maxMessages ?? 5,
        WaitTimeSeconds: options.waitTimeSeconds ?? 20, // long-poll
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
      })
    );
    return result.Messages ?? [];
  }

  /** Delete a message after successful processing */
  async delete(queueUrl: string, receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle })
    );
  }

  /** Send a message to a queue (used in tests / manual triggers) */
  async send(queueUrl: string, body: Record<string, unknown>): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(body),
      })
    );
  }
}
