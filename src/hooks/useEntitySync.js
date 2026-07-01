import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { acquireRealtime, releaseRealtime, onRealtimeMessage } from '@/lib/realtime';

// Invalidates any React Query cache whose key mentions the changed entity type,
// so pages viewing the same record refetch automatically when another user
// edits it. Query keys aren't a fixed convention across pages (e.g. 'trip',
// 'trips', 'clientTrips', 'tripInvoices'), so this matches by substring rather
// than requiring an exact key — broader than a perfect match, but safe: a false
// positive is just an extra refetch, never a missed one.
export function useEntitySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    acquireRealtime();
    const unsubscribe = onRealtimeMessage((data) => {
      if (data.type !== 'entity_change' || !data.entityType) return;
      const needle = data.entityType.toLowerCase();
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.some((k) => typeof k === 'string' && k.toLowerCase().includes(needle)),
      });
    });
    return () => {
      unsubscribe();
      releaseRealtime();
    };
  }, [queryClient]);
}
