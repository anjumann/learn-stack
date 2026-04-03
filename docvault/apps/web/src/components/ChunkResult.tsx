'use client';
import type { ChunkDto } from '@docvault/types';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

export function ChunkResult({ chunk }: { chunk: ChunkDto }) {
  const scorePercent = Math.round(chunk.score * 100);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {chunk.filename} · chunk #{chunk.chunkIndex}
          </span>
          <Badge variant="secondary" className="shrink-0">{scorePercent}% match</Badge>
        </div>

        {/* Score bar — makes cosine similarity visible */}
        <div className="space-y-1">
          <Progress value={scorePercent} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            Cosine similarity: {chunk.score.toFixed(4)}
          </p>
        </div>

        <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
          {chunk.text}
        </p>
      </CardContent>
    </Card>
  );
}
