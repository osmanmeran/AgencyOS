import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonCard() {
  return (
    <div className="bg-m3-surface rounded-large border border-m3-outline-variant p-6 space-y-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="bg-m3-surface rounded-large border border-m3-outline-variant overflow-hidden">
      <div className="grid grid-cols-4 gap-4 p-4 border-b border-m3-outline-variant">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-3/4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid grid-cols-4 gap-4 p-4 border-b border-m3-outline-variant last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-3/4' : 'w-1/2'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-m3-surface rounded-large border border-m3-outline-variant">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-m3-surface rounded-large border border-m3-outline-variant p-5 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 4 }) {
  return (
    <div className="bg-m3-surface rounded-large border border-m3-outline-variant p-6 space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-small" />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    </div>
  );
}
