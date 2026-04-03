'use client';
import { useDispatch } from 'react-redux';
import { Trash2, Download } from 'lucide-react';
import type { DocumentDto } from '@docvault/types';
import { AppDispatch } from '../store';
import { deleteDocument, getDownloadUrl } from '../store/documentsSlice';
import { Card, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

type StatusVariant = 'pending' | 'uploaded' | 'indexed' | 'unindexable' | 'deleting';

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  uploaded: 'Uploaded',
  indexed: 'Indexed',
  unindexable: 'Unindexable',
  deleting: 'Deleting…',
};

export function DocumentCard({ doc }: { doc: DocumentDto }) {
  const dispatch = useDispatch<AppDispatch>();

  const handleDownload = async () => {
    const url = await dispatch(getDownloadUrl(doc.id)).unwrap();
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{doc.filename}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{doc.mimeType}</p>
          </div>
          <Badge variant={doc.status as StatusVariant}>{statusLabel[doc.status] ?? doc.status}</Badge>
        </div>

        {/* chunkCount makes vector indexing tangible */}
        {doc.status === 'indexed' && doc.chunkCount !== null && (
          <p className="text-xs text-muted-foreground mt-2">
            {doc.chunkCount} chunks indexed in Qdrant
          </p>
        )}
        {doc.status === 'unindexable' && (
          <p className="text-xs text-red-500 mt-2">
            Scanned PDF — no text extracted
          </p>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={doc.status === 'pending'}>
          <Download className="h-3 w-3" />
          Download
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => dispatch(deleteDocument(doc.id))}
          disabled={doc.status === 'deleting'}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
