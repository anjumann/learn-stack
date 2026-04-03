import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Counter } from 'prom-client';
import { v4 as uuidv4 } from 'uuid';
import { S3Service, SnsService } from '@docvault/aws';
import {
  DocumentDto,
  PresignRequestDto,
  PresignResponseDto,
  SnsDocumentEvent,
} from '@docvault/types';
import { Document } from './document.entity';

const uploadCounter = new Counter({
  name: 'document_uploads_total',
  help: 'Total document uploads',
  labelNames: ['status'],
});

const snsPublishCounter = new Counter({
  name: 'sns_publish_total',
  help: 'Total SNS publish calls',
  labelNames: ['event_type', 'status'],
});

@Injectable()
export class DocumentsService {
  private readonly s3 = new S3Service();
  private readonly sns = new SnsService();

  constructor(
    @InjectRepository(Document)
    private readonly repo: Repository<Document>,
    private readonly _config: ConfigService,
  ) {}

  async presign(dto: PresignRequestDto): Promise<PresignResponseDto> {
    const ext = dto.filename.split('.').pop();
    const s3Key = `uploads/${uuidv4()}.${ext}`;

    const doc = this.repo.create({
      filename: dto.filename,
      mimeType: dto.contentType,
      s3Key,
      status: 'pending',
    });
    await this.repo.save(doc);

    const uploadUrl = await this.s3.presignPut(s3Key, dto.contentType);
    uploadCounter.labels('presigned').inc();

    return { documentId: doc.id, uploadUrl, s3Key };
  }

  async confirm(id: string, s3Key: string): Promise<DocumentDto> {
    const doc = await this.findOneOrFail(id);
    doc.status = 'uploaded';
    await this.repo.save(doc);

    const event: SnsDocumentEvent = {
      eventType: 'document.uploaded',
      documentId: doc.id,
      s3Key: doc.s3Key,
      filename: doc.filename,
      mimeType: doc.mimeType,
    };

    try {
      await this.sns.publish(
        event as unknown as Record<string, unknown>,
        'document.uploaded',
      );
      snsPublishCounter.labels('document.uploaded', 'success').inc();
    } catch (err) {
      snsPublishCounter.labels('document.uploaded', 'failure').inc();
      throw err;
    }

    uploadCounter.labels('confirmed').inc();
    return this.toDto(doc);
  }

  async findAll(): Promise<DocumentDto[]> {
    const docs = await this.repo.find({ order: { createdAt: 'DESC' } });
    return docs.map((d) => this.toDto(d));
  }

  async softDelete(id: string): Promise<void> {
    const doc = await this.findOneOrFail(id);
    doc.status = 'deleting';
    await this.repo.save(doc);

    const event: SnsDocumentEvent = {
      eventType: 'document.deleted',
      documentId: doc.id,
      s3Key: doc.s3Key,
      filename: doc.filename,
      mimeType: doc.mimeType,
    };

    try {
      await this.sns.publish(
        event as unknown as Record<string, unknown>,
        'document.deleted',
      );
      snsPublishCounter.labels('document.deleted', 'success').inc();
    } catch (err) {
      snsPublishCounter.labels('document.deleted', 'failure').inc();
      throw err;
    }
  }

  async presignDownload(id: string): Promise<string> {
    const doc = await this.findOneOrFail(id);
    return this.s3.presignGet(doc.s3Key);
  }

  private async findOneOrFail(id: string): Promise<Document> {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  private toDto(doc: Document): DocumentDto {
    return {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      s3Key: doc.s3Key,
      status: doc.status as DocumentDto['status'],
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
