import { QueryClient, QueryCache } from '@tanstack/react-query';
import { showError } from './toast';

export const queryClientInstance = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      showError('Failed to load data', error?.message);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Real mutations invalidate affected queries immediately over
      // WebSocket (see useEntitySync), so this only cuts refetches on
      // plain remounts/tab switches — it doesn't risk showing stale data.
      staleTime: 60 * 1000,
      // Purge inactive query data after 10 min so long sessions don't
      // accumulate every list they've ever viewed in memory.
      gcTime: 10 * 60 * 1000,
    },
  },
});
