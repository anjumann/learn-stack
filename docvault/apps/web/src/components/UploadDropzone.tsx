'use client';
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Upload } from 'lucide-react';
import type { RootState, AppDispatch } from '../store';
import { uploadDocument } from '../store/documentsSlice';

const ACCEPTED = '.pdf,.md,.txt,application/pdf,text/markdown,text/plain';

export function UploadDropzone() {
  const dispatch = useDispatch<AppDispatch>();
  const uploading = useSelector((s: RootState) => s.documents.uploading);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => dispatch(uploadDocument(file)));
    },
    [dispatch]
  );

  return (
    <label
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors ${
        dragging ? 'border-primary bg-accent' : 'border-muted-foreground/30 hover:border-primary/50'
      } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">
          {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, Markdown, plain text</p>
        <p className="text-xs text-muted-foreground">
          Uploads go directly to S3 via presigned URL
        </p>
      </div>
      <input
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
      />
    </label>
  );
}
