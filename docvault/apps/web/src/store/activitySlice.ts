import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { ActivityDto } from '@docvault/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const fetchActivity = createAsyncThunk(
  'activity/fetch',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}) => {
    const res = await fetch(`${API}/activity?page=${page}&limit=${limit}`);
    return res.json() as Promise<{
      items: ActivityDto[];
      total: number;
      page: number;
      limit: number;
    }>;
  }
);

interface ActivityState {
  feed: ActivityDto[];
  total: number;
  page: number;
  isFetching: boolean;
}

const initialState: ActivityState = {
  feed: [],
  total: 0,
  page: 1,
  isFetching: false,
};

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivity.pending, (state) => { state.isFetching = true; })
      .addCase(fetchActivity.fulfilled, (state, action) => {
        state.isFetching = false;
        state.feed = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchActivity.rejected, (state) => { state.isFetching = false; });
  },
});

export default activitySlice.reducer;
