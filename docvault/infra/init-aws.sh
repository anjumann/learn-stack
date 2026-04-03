#!/bin/bash
set -e

echo "===> Initializing LocalStack AWS resources..."

REGION="us-east-1"
ACCOUNT_ID="000000000000"
ENDPOINT="http://localhost:4566"

# ---------------------------------------------------------------------------
# S3 — versioned bucket
# ---------------------------------------------------------------------------
echo "--> Creating S3 bucket: documents-bucket"
awslocal s3api create-bucket --bucket documents-bucket --region $REGION
awslocal s3api put-bucket-versioning \
  --bucket documents-bucket \
  --versioning-configuration Status=Enabled
echo "    documents-bucket created with versioning enabled"

# ---------------------------------------------------------------------------
# SNS — single fan-out topic
# ---------------------------------------------------------------------------
echo "--> Creating SNS topic: document-events"
TOPIC_ARN=$(awslocal sns create-topic --name document-events --query TopicArn --output text)
echo "    Topic ARN: $TOPIC_ARN"

# ---------------------------------------------------------------------------
# SQS — helper to create a queue + DLQ pair
# ---------------------------------------------------------------------------
create_queue_with_dlq() {
  local NAME=$1
  local DLQ_NAME="${NAME}-dlq"

  echo "--> Creating DLQ: $DLQ_NAME"
  DLQ_URL=$(awslocal sqs create-queue --queue-name "$DLQ_NAME" --query QueueUrl --output text)
  DLQ_ARN=$(awslocal sqs get-queue-attributes \
    --queue-url "$DLQ_URL" \
    --attribute-names QueueArn \
    --query Attributes.QueueArn --output text)
  echo "    DLQ ARN: $DLQ_ARN"

  echo "--> Creating queue: $NAME (redrive -> $DLQ_NAME after 3 attempts)"
  QUEUE_URL=$(awslocal sqs create-queue \
    --queue-name "$NAME" \
    --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
    --query QueueUrl --output text)
  QUEUE_ARN=$(awslocal sqs get-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attribute-names QueueArn \
    --query Attributes.QueueArn --output text)
  echo "    Queue ARN: $QUEUE_ARN"

  # Export for use by caller
  export LAST_QUEUE_URL="$QUEUE_URL"
  export LAST_QUEUE_ARN="$QUEUE_ARN"
}

# ---------------------------------------------------------------------------
# SQS — create all queues
# ---------------------------------------------------------------------------
create_queue_with_dlq "indexing-queue"
INDEXING_QUEUE_URL=$LAST_QUEUE_URL
INDEXING_QUEUE_ARN=$LAST_QUEUE_ARN

create_queue_with_dlq "deletion-queue"
DELETION_QUEUE_URL=$LAST_QUEUE_URL
DELETION_QUEUE_ARN=$LAST_QUEUE_ARN

create_queue_with_dlq "activity-queue"
ACTIVITY_QUEUE_URL=$LAST_QUEUE_URL
ACTIVITY_QUEUE_ARN=$LAST_QUEUE_ARN

create_queue_with_dlq "email-queue"
EMAIL_QUEUE_URL=$LAST_QUEUE_URL
EMAIL_QUEUE_ARN=$LAST_QUEUE_ARN

# ---------------------------------------------------------------------------
# SNS -> SQS subscriptions with filter policies
# ---------------------------------------------------------------------------
echo "--> Subscribing indexing-queue (filter: document.uploaded, document.updated)"
awslocal sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$INDEXING_QUEUE_ARN" \
  --attributes '{"FilterPolicy":"{\"eventType\":[\"document.uploaded\",\"document.updated\"]}","FilterPolicyScope":"MessageAttributes"}'

echo "--> Subscribing deletion-queue (filter: document.deleted)"
awslocal sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$DELETION_QUEUE_ARN" \
  --attributes '{"FilterPolicy":"{\"eventType\":[\"document.deleted\"]}","FilterPolicyScope":"MessageAttributes"}'

echo "--> Subscribing activity-queue (no filter — receives all events)"
awslocal sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$ACTIVITY_QUEUE_ARN"

echo "--> Subscribing email-queue (filter: document.indexed, document.failed, document.deleted)"
awslocal sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$EMAIL_QUEUE_ARN" \
  --attributes '{"FilterPolicy":"{\"eventType\":[\"document.indexed\",\"document.failed\",\"document.deleted\"]}","FilterPolicyScope":"MessageAttributes"}'

# ---------------------------------------------------------------------------
# Allow SNS to publish to all SQS queues
# ---------------------------------------------------------------------------
for QUEUE_ARN in "$INDEXING_QUEUE_ARN" "$DELETION_QUEUE_ARN" "$ACTIVITY_QUEUE_ARN" "$EMAIL_QUEUE_ARN"; do
  QUEUE_NAME=$(echo "$QUEUE_ARN" | awk -F: '{print $NF}')
  QUEUE_URL="$ENDPOINT/000000000000/$QUEUE_NAME"
  awslocal sqs set-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attributes "{\"Policy\":\"{\\\"Version\\\":\\\"2012-10-17\\\",\\\"Statement\\\":[{\\\"Effect\\\":\\\"Allow\\\",\\\"Principal\\\":{\\\"Service\\\":\\\"sns.amazonaws.com\\\"},\\\"Action\\\":\\\"sqs:SendMessage\\\",\\\"Resource\\\":\\\"$QUEUE_ARN\\\",\\\"Condition\\\":{\\\"ArnEquals\\\":{\\\"aws:SourceArn\\\":\\\"$TOPIC_ARN\\\"}}}]}\"}"
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "===> LocalStack resources ready"
echo "    S3 bucket:         documents-bucket (versioned)"
echo "    SNS topic:         document-events"
echo "    SNS topic ARN:     $TOPIC_ARN"
echo "    SQS queues:        indexing-queue, deletion-queue, activity-queue, email-queue"
echo "    SQS DLQs:          indexing-dlq, deletion-dlq, activity-dlq, email-dlq"
