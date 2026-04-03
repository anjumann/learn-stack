'use client';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { fetchDocuments } from '../store/documentsSlice';
import { UploadDropzone } from '../components/UploadDropzone';
import { DocumentCard } from '../components/DocumentCard';

export default function DocumentsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, status } = useSelector((s: RootState) => s.documents);

  // Initial load + poll for status changes (indexed, etc.)
  useEffect(() => {
    dispatch(fetchDocuments());
    const interval = setInterval(() => dispatch(fetchDocuments()), 5000);
    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload PDFs or Markdown files. Status updates every 5s as the worker indexes them.
        </p>
      </div>

      <UploadDropzone />

      {status === 'loading' && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {items.length === 0 && status !== 'loading' && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No documents yet. Upload one above.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
}
