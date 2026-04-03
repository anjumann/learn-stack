// Document status state machine: pending → uploaded → indexed | unindexable | deleting
export type DocumentStatus =
  | 'pending'
  | 'uploaded'
  | 'indexed'
  | 'unindexable'
  | 'deleting';

export interface DocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  s3Key: string;
  status: DocumentStatus;
  chunkCount: number | null;
  createdAt: string; // ISO 8601
}

// A single matched chunk returned by RAG search
export interface ChunkDto {
  text: string;
  score: number; // cosine similarity 0–1
  documentId: string;
  filename: string;
  chunkIndex: number;
}

export interface SearchResultDto {
  chunks: ChunkDto[];
  query: string;
}

export interface ActivityDto {
  id: string;
  eventType: string;
  documentId: string;
  filename: string;
  occurredAt: string; // ISO 8601
}

// SNS message body shared between API (publisher) and Worker (consumer)
export interface SnsDocumentEvent {
  eventType:
    | 'document.uploaded'
    | 'document.updated'
    | 'document.indexed'
    | 'document.failed'
    | 'document.deleted';
  documentId: string;
  s3Key: string;
  filename: string;
  mimeType: string;
}

// Presign request / response
export interface PresignRequestDto {
  filename: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface PresignResponseDto {
  documentId: string;
  uploadUrl: string; // presigned S3 PUT URL
  s3Key: string;
}

// Confirm upload
export interface ConfirmUploadDto {
  s3Key: string;
}

// Search request
export interface SearchRequestDto {
  query: string;
  topK?: number; // default 5
}
