import { useState, useCallback } from 'react';

// Tracks selection across the current page of `items`. "Select all" only
// covers what's actually loaded (the current page), not every record
// matching the search/filter — selecting across pages isn't supported here.
export function useSelection(items, getId = (item) => item.id) {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggle = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      const ids = items.map(getId);
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }, [items, getId]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const allSelected = items.length > 0 && items.every(item => selectedIds.has(getId(item)));

  return { selectedIds, toggle, toggleAll, clear, allSelected, count: selectedIds.size };
}
