import { configureStore } from '@reduxjs/toolkit';
import documentsReducer from './documentsSlice';
import searchReducer from './searchSlice';
import activityReducer from './activitySlice';

export const store = configureStore({
  reducer: {
    documents: documentsReducer,
    search: searchReducer,
    activity: activityReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
