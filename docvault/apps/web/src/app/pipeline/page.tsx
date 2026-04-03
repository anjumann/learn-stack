'use client';

const GRAFANA = process.env.NEXT_PUBLIC_GRAFANA_URL ?? 'http://localhost:3030';

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live Prometheus metrics from docvault-api (port 3001) and docvault-worker (port 3002),
          visualized in Grafana.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 text-sm">
        <a
          href={`${GRAFANA}/d/pipeline`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border p-4 hover:bg-accent transition-colors"
        >
          <p className="font-medium">Pipeline Health</p>
          <p className="text-muted-foreground text-xs mt-1">Upload rate, queue depth, DLQ count, indexing p95</p>
        </a>
        <a
          href={`${GRAFANA}/d/search`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border p-4 hover:bg-accent transition-colors"
        >
          <p className="font-medium">Search Performance</p>
          <p className="text-muted-foreground text-xs mt-1">Search latency p50/p95/p99, Infinity + Qdrant latency</p>
        </a>
        <a
          href={`${GRAFANA}/d/system`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border p-4 hover:bg-accent transition-colors"
        >
          <p className="font-medium">System Health</p>
          <p className="text-muted-foreground text-xs mt-1">CPU, heap memory, event loop lag per service</p>
        </a>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <iframe
          src={`${GRAFANA}/d/pipeline?orgId=1&kiosk`}
          className="w-full"
          style={{ height: '600px', border: 'none' }}
          title="Pipeline Health Dashboard"
        />
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-xs space-y-1 text-muted-foreground">
        <p><strong>How this works:</strong></p>
        <p>• Prometheus scrapes <code>/metrics</code> from API (port 3001) and Worker (port 3002) every 10s</p>
        <p>• prom-client auto-collects Node.js process metrics (CPU, heap, event loop)</p>
        <p>• Custom counters/histograms track uploads, SNS publishes, SQS processing, embeddings, and Qdrant ops</p>
        <p>• Grafana queries Prometheus via PromQL to visualize time-series data</p>
        <p>
          Grafana: <a href={GRAFANA} target="_blank" rel="noreferrer" className="underline">{GRAFANA}</a>
          {' '}(admin / admin123) | Prometheus: <a href="http://localhost:9090" target="_blank" rel="noreferrer" className="underline">localhost:9090</a>
        </p>
      </div>
    </div>
  );
}
