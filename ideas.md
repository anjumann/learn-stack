# Project Ideas — Full Stack Learning

Each idea is designed to give hands-on depth with: **Nx monorepo, NestJS, Next.js, LocalStack (SNS/SQS/S3), Redux, and TDD**.

---

## 1. Distributed Job Processing Dashboard

**What it is:** A system where users submit long-running "jobs" (CSV processing, report generation, image resizing) via a UI, and a worker fleet processes them asynchronously.

**Why it's good for learning:**
- Deep SQS usage: job queues, dead-letter queues, visibility timeouts, retry logic
- SNS fan-out: one job event notifies multiple subscribers (email, webhook, audit log)
- S3: store job input/output artifacts with presigned URLs
- Redux: polling or SSE-driven job status updates across the UI
- TDD: rich domain logic (job state machine: queued → processing → done/failed)

**Key flows:**
1. User submits a job → NestJS API → message published to SQS
2. NestJS worker consumes queue → processes → uploads result to S3
3. Worker publishes completion event to SNS → multiple consumers react
4. Next.js frontend polls or subscribes to status → Redux manages job list state

---

## 2. Event-Driven E-Commerce Order System

**What it is:** A simplified online store where placing an order triggers a chain of independent services — inventory check, invoice generation, and shipping notification — each decoupled via events.

**Why it's good for learning:**
- SNS topic per event type (`order.placed`, `order.shipped`) with multiple SQS subscribers
- S3: store generated PDF invoices, accessible via presigned URLs
- Redux: cart state, order history, optimistic UI updates
- TDD: each microservice (inventory, invoice, shipping) tested in isolation with mocked queues

**Key flows:**
1. User places order → NestJS publishes `order.placed` SNS event
2. Three independent SQS consumers react: inventory deducts stock, invoice PDF → S3, notification queued
3. Next.js order tracking page driven by Redux with real-time status

---

## 3. Real-Time File Processing Pipeline

**What it is:** Users upload files (images, CSVs, documents) and watch them move through a processing pipeline with live status updates.

**Why it's good for learning:**
- S3 multipart uploads and S3 event notifications → SNS → SQS pipeline
- SQS: separate queues per processing stage (validate → transform → store)
- Redux: live pipeline stage visualization (stage-by-stage progress)
- TDD: each pipeline stage unit-tested independently; integration tests against LocalStack

**Key flows:**
1. Next.js uploads file to S3 (via presigned URL from NestJS)
2. S3 event triggers SNS notification → fan-out to SQS queues
3. NestJS workers process each stage, update status in DB, emit events
4. Frontend Redux store reflects pipeline state in real time

---

## 4. Multi-Channel Notification Platform

**What it is:** A notification service where applications publish events to SNS topics, and end users subscribe to receive alerts through different channels (in-app, email digest, webhook).

**Why it's good for learning:**
- SNS topic/subscription model in depth: filtering policies, delivery retries
- SQS: email digest queue batches messages before sending; webhook queue with retry/DLQ
- S3: archive all notifications for audit history
- Redux: notification preferences UI, real-time notification feed
- TDD: subscription filter logic, deduplication, retry policies

**Key flows:**
1. Any service publishes an event to an SNS topic
2. SNS routes to SQS queues based on filter policies (email vs. in-app vs. webhook)
3. NestJS consumers drain queues and deliver through respective channels
4. Next.js notification centre powered by Redux

---

## 5. Collaborative Document Store

**What it is:** A lightweight document management app where users can upload, version, tag, and share documents — with background async indexing and change notifications.

**Why it's good for learning:**
- S3: versioned buckets, metadata, presigned download URLs, lifecycle policies
- SNS/SQS: document change events trigger async indexing and activity feed updates
- Redux: document list with optimistic updates on upload/delete/rename
- TDD: versioning logic, access control rules, queue consumer idempotency

**Key flows:**
1. User uploads document → stored in versioned S3 bucket
2. Upload event → SNS → SQS indexing queue → NestJS indexes metadata
3. Another SQS consumer writes to an activity feed
4. Next.js shows document list and activity feed, state managed with Redux slices

---

## Recommendation

Start with **Idea 1 (Job Processing Dashboard)** — it is the most self-contained, forces you to understand SQS mechanics deeply (DLQ, retries, visibility timeout), and every piece of the stack plays a clear, distinct role. Once comfortable, **Idea 2** adds SNS fan-out complexity on top.
