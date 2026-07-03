import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { db } from '@/lib/DbContext';

const DEBOUNCE_MS = 350;

// Server-side paginated + searched entity list. Query key starts with the
// entity type string so useEntitySync's WebSocket-driven invalidation (which
// substring-matches entity type against query keys) picks this up for free.
/**
 * @param {string} entityType
 * @param {{ pageSize?: number, sort?: string, filter?: any }} [options]
 */
export function usePaginatedEntities(entityType, { pageSize = 24, sort, filter } = {}) {
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [entityType, 'page', page, pageSize, debouncedSearch, sort, JSON.stringify(filter || {})],
    queryFn: () => db.entities[entityType].page({
      limit: pageSize,
      offset: page * pageSize,
      search: debouncedSearch || undefined,
      sort,
      filter,
    }),
    placeholderData: keepPreviousData,
  });

  const items = data?.data || [];
  const total = data?.total || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    page,
    pageCount,
    pageSize,
    setPage,
    search: searchInput,
    setSearch: setSearchInput,
    isLoading,
    isFetching,
  };
}
