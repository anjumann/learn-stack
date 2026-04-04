#!/bin/bash
# DocVault — start all services
set -e

echo "==> Building api..."
npx nx build api

echo "==> Building worker..."
npx nx build worker

echo "==> Starting API (port 3001)..."
node -r dotenv/config dist/apps/api/main.js &
API_PID=$!
echo "    API PID: $API_PID"

echo "==> Starting Worker (port 3002)..."
node -r dotenv/config dist/apps/worker/main.js &
WORKER_PID=$!
echo "    Worker PID: $WORKER_PID"

echo ""
echo "DocVault running:"
echo "  API:     http://localhost:3001"
echo "  Metrics: http://localhost:3001/metrics"
echo "  Worker:  http://localhost:3002/metrics"
echo ""
echo "Press Ctrl+C to stop all"

trap "kill $API_PID $WORKER_PID 2>/dev/null; echo 'Stopped'" EXIT
wait
