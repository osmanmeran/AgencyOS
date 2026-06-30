import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, X, Star } from 'lucide-react';

// ── Text Filter ──────────────────────────────────────────────────────────

export function SupplierTextFilter({ value, onChange, placeholder }) {
  return (
    <div className="p-2 w-56">
      <Input
        placeholder={placeholder || 'Filter...'}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="h-9"
        autoFocus
      />
      {value && (
        <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs w-full" onClick={() => onChange('')}>
          <X className="w-3 h-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}

// ── Category Filter ──────────────────────────────────────────────────────

export function SupplierCategoryFilter({ categories, selected, onChange }) {
  return (
    <div className="p-2 w-64">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">Select categories</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-xs text-slate-400 px-1">No categories available</p>
        ) : (
          categories.map(cat => {
            const checked = selected.includes(cat.id);
            return (
              <label
                key={cat.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                  checked
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(
                    checked ? selected.filter(id => id !== cat.id) : [...selected, cat.id]
                  )}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                {cat.name}
              </label>
            );
          })
        )}
      </div>
      {selected.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs w-full" onClick={() => onChange([])}>
          <X className="w-3 h-3 mr-1" /> Clear ({selected.length})
        </Button>
      )}
    </div>
  );
}

// ── Rating Filter ────────────────────────────────────────────────────────

export function SupplierRatingFilter({ value, onChange }) {
  const selected = value || [];

  const toggleRating = (r) => {
    const next = selected.includes(r)
      ? selected.filter(v => v !== r)
      : [...selected, r];
    onChange(next.length > 0 ? next : null);
  };

  return (
    <div className="p-3 w-64">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
        {selected.length > 0
          ? `${selected.map(r => `${r}★`).join(', ')} selected`
          : 'Filter by rating'}
      </p>
      <div className="flex flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map(r => {
          const active = selected.includes(r);
          return (
            <button
              key={r}
              onClick={() => toggleRating(r)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                active
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= r ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 dark:text-slate-600'}`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-auto">{r}★</span>
              {active && <span className="w-2 h-2 rounded-full bg-yellow-500 ml-1" />}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs w-full" onClick={() => onChange(null)}>
          <X className="w-3 h-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}

// ── Filter Button (wrapper) ──────────────────────────────────────────────

export function SupplierFilterButton({ active, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`p-1 rounded transition-colors ${
            active
              ? 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40'
              : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}
