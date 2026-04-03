import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

function createS3Client(): S3Client {
  return new S3Client({
    region: process.env['AWS_REGION'] ?? 'us-east-1',
    endpoint: process.env['AWS_ENDPOINT_URL'],
    credentials: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'test',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'test',
    },
    forcePathStyle: true, // required for LocalStack
  });
}

export class S3Service {
  private readonly client = createS3Client();
  private readonly bucket =
    process.env['S3_DOCUMENTS_BUCKET'] ?? 'documents-bucket';

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    const stream = result.Body as Readable;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  /** Delete all versions of a key (needed for versioned buckets) */
  async deleteAllVersions(key: string): Promise<void> {
    const listResult = await this.client.send(
      new ListObjectVersionsCommand({ Bucket: this.bucket, Prefix: key })
    );
    const objects = [
      ...(listResult.Versions ?? []),
      ...(listResult.DeleteMarkers ?? []),
    ].map((v) => ({ Key: v.Key!, VersionId: v.VersionId }));

    if (objects.length === 0) return;

    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: objects },
      })
    );
  }

  /** Generate a presigned PUT URL for direct browser-to-S3 upload */
  async presignPut(
    key: string,
    contentType: string,
    expiresInSeconds = 300
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /** Generate a presigned GET URL for browser download */
  async presignGet(key: string, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
