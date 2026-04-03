'use client';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search } from 'lucide-react';
import type { RootState, AppDispatch } from '../../store';
import { searchDocuments, clearResults } from '../../store/searchSlice';
import { ChunkResult } from '../../components/ChunkResult';
import { Button } from '../../components/ui/button';

export default function SearchPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { result, isSearching, error, query } = useSelector((s: RootState) => s.search);
  const [input, setInput] = useState('');

  const handleSearch = () => {
    if (input.trim()) dispatch(searchDocuments(input.trim()));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Semantic Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Query → Infinity embed → Qdrant similarity search → ranked chunks
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ask anything about your documents…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !input.trim()}>
          {isSearching ? 'Searching…' : 'Search'}
        </Button>
        {result && (
          <Button variant="ghost" onClick={() => { dispatch(clearResults()); setInput(''); }}>
            Clear
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {result.chunks.length} chunk{result.chunks.length !== 1 ? 's' : ''} matched for &ldquo;{query}&rdquo;
          </p>
          {result.chunks.map((chunk, i) => (
            <ChunkResult key={i} chunk={chunk} />
          ))}
          {result.chunks.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No matching chunks found. Try a different query or upload more documents.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
