import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEntitySync } from '@/hooks/useEntitySync';
import { acquireRealtime, releaseRealtime, onRealtimeMessage } from '@/lib/realtime';

vi.mock('@/lib/realtime', () => ({
  acquireRealtime: vi.fn(),
  releaseRealtime: vi.fn(),
  // Default implementation: return a no-op unsubscribe so cleanup never throws.
  onRealtimeMessage: vi.fn(() => () => {}),
}));

let queryClient;
let invalidateSpy;

function Wrapper({ children }) {
  queryClient = new QueryClient();
  invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEntitySync (CRUD hook)', () => {
  it('acquires the realtime channel on mount and releases on unmount', () => {
    const { unmount } = renderHook(() => useEntitySync(), { wrapper: Wrapper });
    expect(acquireRealtime).toHaveBeenCalledTimes(1);
    unmount();
    expect(releaseRealtime).toHaveBeenCalledTimes(1);
  });

  it('invalidates queries whose key mentions the changed entity type', () => {
    let handler;
    onRealtimeMessage.mockImplementation((h) => {
      handler = h;
      return () => {};
    });

    renderHook(() => useEntitySync(), { wrapper: Wrapper });

    act(() => {
      handler({ type: 'entity_change', entityType: 'Client' });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    const { predicate } = invalidateSpy.mock.calls[0][0];
    // Substring match against the lowercased entity type. `invalidateQueries`
    // passes a Query object, so the key lives on `queryKey`.
    expect(predicate({ queryKey: ['client', 'page', 0] })).toBe(true);
    expect(predicate({ queryKey: ['ClientInvoice', 'x'] })).toBe(true);
    expect(predicate({ queryKey: ['trip', 'page', 0] })).toBe(false);
    // Non-string keys are ignored.
    expect(predicate({ queryKey: [123, 'page', 0] })).toBe(false);
  });

  it('ignores non-entity_change messages', () => {
    let handler;
    onRealtimeMessage.mockImplementation((h) => {
      handler = h;
      return () => {};
    });

    renderHook(() => useEntitySync(), { wrapper: Wrapper });

    act(() => {
      handler({ type: 'ping' });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
