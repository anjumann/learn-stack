'use client';
import type { ActivityDto } from '@docvault/types';
import { Badge } from './ui/badge';

const eventBadge: Record<string, string> = {
  'document.uploaded': 'bg-blue-100 text-blue-700',
  'document.indexed': 'bg-green-100 text-green-700',
  'document.deleted': 'bg-red-100 text-red-700',
  'document.failed': 'bg-orange-100 text-orange-700',
  'document.updated': 'bg-purple-100 text-purple-700',
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function ActivityFeed({ items }: { items: ActivityDto[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No activity yet. Upload a document to get started.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-md border px-4 py-3 text-sm">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${eventBadge[item.eventType] ?? 'bg-gray-100 text-gray-600'}`}>
            {item.eventType}
          </span>
          <span className="truncate text-foreground">{item.filename}</span>
          <span className="ml-auto text-xs text-muted-foreground shrink-0">{timeAgo(item.occurredAt)}</span>
        </li>
      ))}
    </ul>
  );
}
