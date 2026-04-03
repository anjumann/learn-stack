import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DocumentDto, PresignResponseDto } from '@docvault/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Async thunks ──────────────────────────────────────────────────────────────

export const fetchDocuments = createAsyncThunk('documents/fetchAll', async () => {
  const res = await fetch(`${API}/documents`);
  return res.json() as Promise<DocumentDto[]>;
});

export const uploadDocument = createAsyncThunk(
  'documents/upload',
  async (file: File, { dispatch }) => {
    // Step 1: Get presigned PUT URL from API
    const presignRes = await fetch(`${API}/documents/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
      }),
    });
    const { documentId, uploadUrl, s3Key }: PresignResponseDto = await presignRes.json();

    // Step 2: Upload directly to S3 via presigned URL (bypasses API)
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    // Step 3: Confirm upload to API → triggers SNS document.uploaded event
    const confirmRes = await fetch(`${API}/documents/${documentId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s3Key }),
    });
    const doc: DocumentDto = await confirmRes.json();

    // Refresh list so status badge updates
    dispatch(fetchDocuments());
    return doc;
  }
);

export const deleteDocument = createAsyncThunk(
  'documents/delete',
  async (id: string, { dispatch }) => {
    await fetch(`${API}/documents/${id}`, { method: 'DELETE' });
    dispatch(fetchDocuments());
    return id;
  }
);

export const getDownloadUrl = createAsyncThunk(
  'documents/download',
  async (id: string) => {
    const res = await fetch(`${API}/documents/${id}/download`);
    const { url } = await res.json();
    return url as string;
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

interface DocumentsState {
  items: DocumentDto[];
  status: 'idle' | 'loading' | 'error';
  uploading: boolean;
  error: string | null;
}

const initialState: DocumentsState = {
  items: [],
  status: 'idle',
  uploading: false,
  error: null,
};

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = action.payload;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message ?? 'Failed to fetch documents';
      })
      .addCase(uploadDocument.pending, (state) => { state.uploading = true; })
      .addCase(uploadDocument.fulfilled, (state) => { state.uploading = false; })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.error.message ?? 'Upload failed';
      });
  },
});

export default documentsSlice.reducer;
