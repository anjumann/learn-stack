# DocVault — RAG-Enabled Document Store: Implementation Plan

## Overview

A document management platform where users upload files, which are automatically
chunked, embedded, and indexed for semantic search. Powered by an event-driven
pipeline (SNS -> SQS) and a RAG search layer (Qdrant + Infinity).

---

## 1. Tech Stack Map

| Layer         | Technology               | Role                                              |
| ------------- | ------------------------ | ------------------------------------------------- |
| Monorepo      | Nx                       | Workspace management, project graph, build cache  |
| Frontend      | Next.js 14 (App Router)  | Upload UI, document browser, search UI            |
| Backend API   | NestJS                   | REST API, presigned URL generation, search        |
| Worker        | NestJS (separate Nx app) | SQS consumers: indexing, deletion, activity       |
| Message Bus   | SNS (LocalStack)         | Fan-out of document lifecycle events              |
| Queue         | SQS (LocalStack)         | Durable async work delivery to worker             |
| File Storage  | S3 (LocalStack)          | Versioned raw document storage                    |
| Vector DB     | Qdrant (Docker)          | Stores and queries document chunk embeddings      |
| Embeddings    | Infinity (Docker)        | Self-hosted embedding inference server (HTTP)     |
| Relational DB | PostgreSQL (existing)    | Document metadata, user data, activity feed       |
| State (FE)    | Redux Toolkit            | Document list, search state, activity feed        |
| Metrics       | Prometheus (existing)    | Scrapes /metrics from API and worker              |
| Dashboards    | Grafana (existing)       | Visualises pipeline health and search latency     |
| Testing       | Jest + Supertest         | TDD at unit, integration, and e2e levels          |

---

## 2. Docker Compose Services

```yaml
services:
  localstack:   # S3, SNS, SQS — port 4566
  qdrant:       # Vector similarity search — port 6333 (HTTP), 6334 (gRPC)
  infinity:     # Embedding inference server — port 7997
```

**PostgreSQL — existing container (no new service):**

Connect to your existing Postgres instance and create a dedicated database:

```sql
CREATE DATABASE docvault;
```

**Prometheus + Grafana — existing containers (no new service):**

```bash
docker start rag-prometheus rag-grafana
```

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3030` (admin / admin123)

See Section 11 for how to wire DocVault into these.

**Infinity config:**

- Image: `michaelf34/infinity`
- Model: `BAAI/bge-small-en-v1.5` (fast, 384-dim, good quality)
- Endpoint: `POST http://localhost:7997/embeddings` (OpenAI-compatible format)

**Qdrant config:**

- Image: `qdrant/qdrant`
- Collection: `document_chunks` — vector size 384, cosine distance

---

## 3. Nx Monorepo Structure

```text
apps/
  web/          # Next.js 14 frontend
  api/          # NestJS REST API (port 3001)
  worker/       # NestJS SQS consumer worker (port 3002)

libs/
  types/        # Shared TypeScript interfaces & DTOs
  aws/          # Reusable S3 / SNS / SQS service wrappers
  chunking/     # Text extraction + chunking logic (pure, testable)
```

**Why this split:**

- `libs/chunking` is pure logic with no framework deps — easiest to TDD
- `libs/aws` isolates all AWS SDK v3 code — swap LocalStack vs real AWS by env var
- `apps/worker` is a separate process — can scale independently, crash without taking down API

---

## 4. AWS Resources (LocalStack)

### S3

| Resource           | Config                      |
| ------------------ | --------------------------- |
| `documents-bucket` | Versioning enabled, private |

### SNS Topics

| Topic             | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `document-events` | Single topic for all document lifecycle events, attr-filtered |

### SQS Queues

| Queue            | DLQ            | SNS Filter (eventType)                | Purpose                              |
| ---------------- | -------------- | ------------------------------------- | ------------------------------------ |
| `indexing-queue` | `indexing-dlq` | `document.uploaded` or `.updated`     | Trigger chunk + embed pipeline       |
| `deletion-queue` | `deletion-dlq` | `document.deleted`                    | Remove file from S3 + Qdrant vectors |
| `activity-queue` | `activity-dlq` | none — receives all events            | Write to activity feed in Postgres   |

**SNS -> SQS wiring:**

- Each queue subscribes to the `document-events` topic
- Filter policies use message attribute `eventType` (string match)
- DLQs have `maxReceiveCount: 3` — after 3 failures, message moves to DLQ for inspection

### LocalStack Init Script

A shell script (`infra/init-aws.sh`) runs on LocalStack startup via the
`/etc/localstack/init/ready.d/` hook to create all buckets, topics, queues,
and subscriptions automatically.

---

## 5. Data Flows

### 5.1 Upload Flow

```text
[Browser]
  | 1. POST /api/documents/presign  { filename, contentType }
  v
[NestJS API]
  | 2. Generate S3 presigned PUT URL (valid 5 min)
  | 3. Save document record in Postgres { status: "pending" }
  v
[Browser]
  | 4. PUT file directly to S3 via presigned URL
  | 5. POST /api/documents/:id/confirm  { s3Key }
  v
[NestJS API]
  | 6. Update Postgres { status: "uploaded" }
  | 7. Publish SNS message:
  |      Topic: document-events
  |      Attributes: { eventType: "document.uploaded" }
  |      Body: { documentId, s3Key, filename, mimeType }
  v
[SNS]
  | 8. Fan-out to indexing-queue + activity-queue
```

### 5.2 Indexing Flow (Worker)

```text
[Worker - IndexingConsumer]
  | 1. Long-poll indexing-queue (20s wait, batch size 5)
  | 2. Download file from S3
  | 3. Extract text:
  |      .pdf  -> pdf-parse
  |      .docx -> mammoth
  |      .txt  -> fs.readFile
  | 4. Chunk text:
  |      Strategy: fixed-size with overlap
  |      chunk_size: 512 tokens, overlap: 64 tokens
  |      Library: custom in libs/chunking (pure function, fully testable)
  | 5. For each chunk:
  |      POST http://infinity:7997/embeddings
  |        { model: "BAAI/bge-small-en-v1.5", input: [chunkText] }
  |      -> returns float32[384] vector
  | 6. Upsert all chunk vectors to Qdrant:
  |      Collection: document_chunks
  |      Payload per point: { documentId, chunkIndex, text, s3Key, filename }
  | 7. Update Postgres { status: "indexed", chunkCount }
  | 8. Delete message from SQS
  | 9. Publish SNS { eventType: "document.indexed" } -> triggers activity-queue
  v
  On failure: do NOT delete message -> visibility timeout expires
              -> SQS redelivers (up to 3 times) -> then DLQ
```

### 5.3 Search / RAG Flow

```text
[Browser]
  | 1. User types query, hits Search
  | 2. POST /api/search  { query: "...", topK: 5 }
  v
[NestJS API - SearchModule]
  | 3. POST http://infinity:7997/embeddings { input: [query] }
  |    -> queryVector: float32[384]
  | 4. Qdrant search:
  |      collection: document_chunks
  |      vector: queryVector
  |      limit: topK
  |      with_payload: true
  |    -> returns top-K chunks with score + payload
  | 5. Fetch source document metadata from Postgres for each result
  | 6. Return SearchResponseDto:
  |      { chunks: [{ text, score, documentId, filename, chunkIndex }] }
  |    (Optional RAG step: call Claude API with chunks as context)
  v
[Browser - Redux searchSlice]
  | 7. Store results, highlight matching chunks per document
```

### 5.4 Deletion Flow (Worker)

```text
[Browser]
  | 1. DELETE /api/documents/:id
  v
[NestJS API]
  | 2. Soft-delete in Postgres { status: "deleting" }
  | 3. Publish SNS { eventType: "document.deleted", documentId, s3Key }
  v
[Worker - DeletionConsumer]
  | 4. Delete object from S3 (all versions)
  | 5. Delete all Qdrant points where payload.documentId = id
  | 6. Hard-delete Postgres record
  | 7. Delete SQS message
```

### 5.5 Activity Flow (Worker)

```text
[Worker - ActivityConsumer]
  | 1. Polls activity-queue (receives ALL event types)
  | 2. Parses eventType + metadata from SNS envelope
  | 3. Inserts row into Postgres activity_log table:
  |      { eventType, documentId, filename, occurredAt }
  | 4. Deletes SQS message
  v
[Browser]
  | 5. GET /api/activity -> paginated activity feed
  | 6. Redux activitySlice stores feed, polling every 5s
```

---

## 6. NestJS Modules

### apps/api

| Module            | Responsibility                                                |
| ----------------- | ------------------------------------------------------------- |
| `DocumentsModule` | CRUD, presigned URL generation, status updates                |
| `SearchModule`    | Embed query via Infinity, search Qdrant, return ranked chunks |
| `ActivityModule`  | Serve paginated activity feed from Postgres                   |
| `S3Module`        | Wrapper around `@aws-sdk/client-s3` (global provider)         |
| `SnsModule`       | SNS publish helper (global provider)                          |
| `MetricsModule`   | Expose `/metrics` endpoint via prom-client                    |

### apps/worker

| Module                   | Responsibility                                          |
| ------------------------ | ------------------------------------------------------- |
| `IndexingConsumerModule` | Extraction -> chunking -> embedding -> Qdrant pipeline  |
| `DeletionConsumerModule` | S3 + Qdrant + Postgres cleanup on document.deleted      |
| `ActivityConsumerModule` | Write activity_log rows from all event types            |
| `SqsModule`              | SQS polling loop abstraction (global provider)          |
| `QdrantModule`           | Qdrant JS client wrapper (global provider)              |
| `InfinityModule`         | HTTP client to Infinity embedding server                |
| `MetricsModule`          | Expose `/metrics` endpoint for worker-specific counters |

### libs/aws

| Export       | Wraps                                                    |
| ------------ | -------------------------------------------------------- |
| `S3Service`  | `@aws-sdk/client-s3` — upload, download, delete, presign |
| `SnsService` | `@aws-sdk/client-sns` — publish with message attributes  |
| `SqsService` | `@aws-sdk/client-sqs` — send, receive, delete, DLQ       |

### libs/chunking

| Export          | Logic                                                       |
| --------------- | ----------------------------------------------------------- |
| `TextExtractor` | Dispatch to pdf-parse / mammoth / readFile by mime type     |
| `TextChunker`   | Split text into fixed-size chunks with configurable overlap |

### libs/types

| Export             | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `DocumentDto`      | API response shape                               |
| `SearchResultDto`  | Search chunk result                              |
| `ActivityDto`      | Activity feed item                               |
| `SnsDocumentEvent` | SNS message body schema (shared by API + worker) |

---

## 7. Next.js Frontend Structure

```text
app/
  (dashboard)/
    page.tsx              # Document list: upload button, document cards
    search/page.tsx       # Search bar + results with chunk highlights
    activity/page.tsx     # Activity feed

components/
  DocumentCard.tsx        # Shows filename, status badge, download/delete actions
  UploadDropzone.tsx      # Drag-and-drop, calls presign -> direct S3 upload
  SearchBar.tsx           # Query input, dispatches searchSlice.search()
  ChunkResult.tsx         # Renders a single matched chunk with score + source
  ActivityFeed.tsx        # Scrollable list of activity events
```

### Redux Slices

| Slice            | State                                      |
| ---------------- | ------------------------------------------ |
| `documentsSlice` | `{ items[], status, uploadProgress }`      |
| `searchSlice`    | `{ query, results[], isSearching, error }` |
| `activitySlice`  | `{ feed[], page, isFetching }`             |

---

## 8. TDD Strategy

### libs/chunking (pure unit tests — no infra needed)

- `TextChunker` — assert correct chunk count, overlap, edge cases (empty string, exact boundary)
- `TextExtractor` — mock fs/pdf-parse/mammoth, assert correct text output per mime type

### libs/aws (integration tests against LocalStack)

- `S3Service` — upload, download, delete, presign URL validity
- `SnsService` — publish, verify message received on subscribed SQS queue
- `SqsService` — send, receive, delete, DLQ flow after 3 failures

### apps/api (e2e tests with Supertest + LocalStack)

- `POST /documents/presign` — returns valid presigned URL
- `POST /documents/:id/confirm` — saves metadata, publishes SNS event
- `POST /search` — returns ranked chunks (Qdrant seeded with test data)
- `DELETE /documents/:id` — publishes deletion event

### apps/worker (unit tests with mocked dependencies)

- `IndexingConsumer` — mock SQS message, assert Qdrant upsert + Infinity call + Postgres update
- `DeletionConsumer` — mock deletion event, assert S3 + Qdrant + Postgres calls
- `ActivityConsumer` — assert correct DB write per event type

---

## 9. Environment Variables

```bash
# LocalStack
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# S3
S3_DOCUMENTS_BUCKET=documents-bucket

# SNS / SQS
SNS_DOCUMENT_EVENTS_ARN=arn:aws:sns:us-east-1:000000000000:document-events
SQS_INDEXING_QUEUE_URL=http://localhost:4566/000000000000/indexing-queue
SQS_DELETION_QUEUE_URL=http://localhost:4566/000000000000/deletion-queue
SQS_ACTIVITY_QUEUE_URL=http://localhost:4566/000000000000/activity-queue

# Postgres (existing container — dedicated database)
DATABASE_URL=postgresql://<user>:<password>@<existing-host>:<port>/docvault

# Qdrant
QDRANT_URL=http://localhost:6333

# Infinity
INFINITY_URL=http://localhost:7997
INFINITY_MODEL=BAAI/bge-small-en-v1.5
```

---

## 10. Implementation Phases

### Phase 1 — Infrastructure

- [ ] `docker-compose.yml` with localstack, qdrant, infinity (postgres + observability reused)
- [ ] `infra/init-aws.sh` — create S3 bucket, SNS topic, SQS queues, subscriptions
- [ ] `CREATE DATABASE docvault;` on existing Postgres instance
- [ ] Nx workspace init (`npx create-nx-workspace`)

### Phase 2 — Shared Libs

- [ ] `libs/types` — all DTOs and event schemas
- [ ] `libs/aws` — S3, SNS, SQS service wrappers + LocalStack integration tests
- [ ] `libs/chunking` — TextExtractor + TextChunker + unit tests

### Phase 3 — API

- [ ] NestJS `apps/api` — all modules, Postgres via TypeORM
- [ ] Upload endpoints (presign + confirm)
- [ ] Activity feed endpoint
- [ ] Search endpoint (Infinity + Qdrant)
- [ ] `/metrics` endpoint (prom-client)
- [ ] e2e tests

### Phase 4 — Worker

- [ ] NestJS `apps/worker` — SQS polling loop base
- [ ] IndexingConsumer (full pipeline)
- [ ] DeletionConsumer
- [ ] ActivityConsumer
- [ ] `/metrics` endpoint (prom-client)
- [ ] Unit tests for all consumers

### Phase 5 — Frontend

- [ ] Next.js `apps/web` — Redux store setup
- [ ] Document list + upload (presign -> direct S3 upload)
- [ ] Search UI with chunk results
- [ ] Activity feed

### Phase 6 — Observability

- [ ] Add DocVault scrape jobs to existing `prometheus.yml`
- [ ] Build Grafana dashboards (pipeline health, search latency, DLQ count)

---

## 11. Observability (Prometheus + Grafana)

### What Prometheus is (and is not)

Prometheus is a **pull-based metrics collection** system. Instead of apps pushing
data to it, Prometheus actively scrapes a `/metrics` HTTP endpoint on each service
at a configurable interval. It stores time-series data in its own local TSDB.

| Prometheus IS               | Prometheus IS NOT                           |
| --------------------------- | ------------------------------------------- |
| Time-series metrics store   | Log aggregator (use Loki for logs)          |
| Pull-based scraper          | Distributed tracing (use Jaeger/Tempo)      |
| PromQL query engine         | Alerting UI (use AlertManager for routing)  |
| Grafana data source         | A push receiver (by default)                |

### Reusing Existing Containers

Your `rag-prometheus` and `rag-grafana` containers already exist — just start them:

```bash
docker start rag-prometheus rag-grafana
```

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3030` (admin / admin123)

The existing `prometheus.yml` at `/Users/apple/Desktop/ai-chat-app/prometheus.yml`
already has a `rag-backend` job on port 3001. Add two new jobs for DocVault:

```yaml
  - job_name: 'docvault-api'
    static_configs:
      - targets: ['host.docker.internal:3001']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'docvault-worker'
    static_configs:
      - targets: ['host.docker.internal:3002']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

Then send a reload signal (no restart needed):

```bash
curl -X POST http://localhost:9090/-/reload
```

### NestJS Setup (both API and Worker)

Install `prom-client` and create a `/metrics` endpoint in each NestJS app.
No heavy framework wrapper needed — a single controller + `prom-client` default
registry is enough.

```text
GET /metrics   -> prom-client default registry (process CPU, memory, event loop)
               + custom DocVault counters and histograms
```

### Metrics to Instrument

**apps/api:**

| Metric                         | Type      | Labels                       | What it shows                    |
| ------------------------------ | --------- | ---------------------------- | -------------------------------- |
| `http_requests_total`          | Counter   | route, method, status        | Request rate and error rates     |
| `http_request_duration_seconds`| Histogram | route, method                | API latency p50/p95/p99          |
| `document_uploads_total`       | Counter   | status (success/fail)        | Upload throughput                |
| `search_requests_total`        | Counter   | —                            | Search query volume              |
| `search_duration_seconds`      | Histogram | —                            | End-to-end search latency        |
| `sns_publish_total`            | Counter   | event_type, status           | SNS publish success/failure rate |

**apps/worker:**

| Metric                           | Type      | Labels                  | What it shows                    |
| -------------------------------- | --------- | ----------------------- | -------------------------------- |
| `sqs_messages_processed_total`   | Counter   | queue, status           | Throughput per queue             |
| `sqs_processing_duration_seconds`| Histogram | queue                   | Processing time per queue        |
| `indexing_chunks_created_total`  | Counter   | —                       | Embedding pipeline volume        |
| `dlq_messages_total`             | Counter   | queue                   | Failed messages reaching DLQ     |
| `infinity_embed_duration_seconds`| Histogram | —                       | Embedding inference latency      |
| `qdrant_upsert_duration_seconds` | Histogram | —                       | Vector store write latency       |

### Grafana Dashboards to Build

**Dashboard 1 — Pipeline Health:**

- Upload rate (uploads/min)
- Indexing queue depth (SQS ApproximateNumberOfMessages via LocalStack)
- Messages processed vs failed per queue
- DLQ count per queue (alert threshold: > 0)
- Indexing duration p95

**Dashboard 2 — Search Performance:**

- Search requests/min
- Search latency p50 / p95 / p99
- Infinity embedding latency
- Qdrant query latency

**Dashboard 3 — System Health:**

- API process CPU and memory
- Worker process CPU and memory
- Event loop lag (Node.js)
- Active SQS consumers

---

## Key Learning Outcomes

| Concept                  | Where you will use it                                               |
| ------------------------ | ------------------------------------------------------------------- |
| SNS filter policies      | `document-events` routing to 3 queues by `eventType` attribute      |
| SQS visibility timeout   | Worker processing window; crash = message reappears automatically   |
| Dead-letter queues       | Failed indexing after 3 retries lands in `indexing-dlq`             |
| S3 presigned URLs        | Browser uploads directly to S3 without proxying through the API     |
| S3 versioning            | Every upload creates a new version; deletion tombstones the key     |
| Vector similarity search | Qdrant cosine search over 384-dim embeddings                        |
| Nx library sharing       | `libs/chunking` used by worker; `libs/types` used everywhere        |
| Redux async thunks       | Upload progress, search, activity polling                           |
| TDD with mocked infra    | Worker unit tests mock all external services; chunking is pure      |
| Prometheus scraping      | Pull-based metrics from two NestJS services via `/metrics`          |
| Grafana dashboards       | PromQL queries to surface pipeline health and search performance   |
