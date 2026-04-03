import {
  SNSClient,
  PublishCommand,
  MessageAttributeValue,
} from '@aws-sdk/client-sns';

function createSnsClient(): SNSClient {
  return new SNSClient({
    region: process.env['AWS_REGION'] ?? 'us-east-1',
    endpoint: process.env['AWS_ENDPOINT_URL'],
    credentials: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'test',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'test',
    },
  });
}

export class SnsService {
  private readonly client = createSnsClient();
  private readonly topicArn =
    process.env['SNS_DOCUMENT_EVENTS_ARN'] ??
    'arn:aws:sns:us-east-1:000000000000:document-events';

  /**
   * Publish a message to the document-events topic.
   *
   * @param body      - JSON-serialisable message body
   * @param eventType - Used as SNS message attribute for SQS filter policies
   */
  async publish(
    body: Record<string, unknown>,
    eventType: string
  ): Promise<void> {
    const messageAttributes: Record<string, MessageAttributeValue> = {
      eventType: {
        DataType: 'String',
        StringValue: eventType,
      },
    };

    await this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify(body),
        MessageAttributes: messageAttributes,
      })
    );
  }
}
