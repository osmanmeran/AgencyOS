import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaginatedEntities } from '@/hooks/usePaginatedEntities';
import { db } from '@/lib/DbContext';

vi.mock('@/lib/DbContext', () => ({
  db: {
    entities: { Clients: { page: vi.fn() } },
  },
}));

function wrapper() {
  const qc = new QueryClient();
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  db.entities.Clients.page.mockReset();
});

describe('usePaginatedEntities (CRUD hook)', () => {
  it('loads paginated items and derives total/pageCount', async () => {
    db.entities.Clients.page.mockResolvedValue({
      data: [{ id: '1' }, { id: '2' }],
      total: 42,
    });

    const { result } = renderHook(() => usePaginatedEntities('Clients', { pageSize: 10 }), {
      wrapper: wrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.total).toBe(42);
    expect(result.current.pageCount).toBe(5); // ceil(42 / 10)
    expect(result.current.page).toBe(0);
    expect(db.entities.Clients.page).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 0 }));
  });

  it('forwards search and sort options to the API', async () => {
    db.entities.Clients.page.mockResolvedValue({ data: [], total: 0 });

    renderHook(() => usePaginatedEntities('Clients', { pageSize: 5, sort: 'name', filter: { active: true } }), {
      wrapper: wrapper(),
    });

    await waitFor(() =>
      expect(db.entities.Clients.page).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, sort: 'name', filter: { active: true } }),
      ),
    );
  });
});
