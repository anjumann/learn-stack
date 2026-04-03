import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { SearchResultDto } from '@docvault/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const searchDocuments = createAsyncThunk(
  'search/query',
  async (query: string) => {
    const res = await fetch(`${API}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK: 5 }),
    });
    return res.json() as Promise<SearchResultDto>;
  }
);

interface SearchState {
  query: string;
  result: SearchResultDto | null;
  isSearching: boolean;
  error: string | null;
}

const initialState: SearchState = {
  query: '',
  result: null,
  isSearching: false,
  error: null,
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    clearResults: (state) => { state.result = null; state.query = ''; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchDocuments.pending, (state, action) => {
        state.isSearching = true;
        state.query = action.meta.arg;
        state.error = null;
      })
      .addCase(searchDocuments.fulfilled, (state, action) => {
        state.isSearching = false;
        state.result = action.payload;
      })
      .addCase(searchDocuments.rejected, (state, action) => {
        state.isSearching = false;
        state.error = action.error.message ?? 'Search failed';
      });
  },
});

export const { clearResults } = searchSlice.actions;
export default searchSlice.reducer;
