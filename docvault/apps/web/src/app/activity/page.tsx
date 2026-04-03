'use client';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { fetchActivity } from '../../store/activitySlice';
import { ActivityFeed } from '../../components/ActivityFeed';

export default function ActivityPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { feed, total, isFetching } = useSelector((s: RootState) => s.activity);

  // Poll every 5s — shows the SNS → SQS → Postgres pipeline as a live stream
  useEffect(() => {
    dispatch(fetchActivity());
    const interval = setInterval(() => dispatch(fetchActivity()), 5000);
    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Events written by the ActivityConsumer (SNS → activity-queue → Postgres). Polls every 5s.
          {total > 0 && <span className="ml-2 text-foreground">{total} total events</span>}
        </p>
      </div>

      {isFetching && feed.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      <ActivityFeed items={feed} />
    </div>
  );
}
