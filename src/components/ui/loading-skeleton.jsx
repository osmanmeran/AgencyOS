import React from 'react';

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-full" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 bg-slate-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
          <div className="w-8 h-8 bg-slate-200 rounded-full" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-slate-200 rounded w-1/3" />
            <div className="h-2 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <span className="text-red-600 text-xl">!</span>
      </div>
      <p className="text-slate-600 mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = 'No data found', action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <span className="text-slate-400 text-xl">-</span>
      </div>
      <p className="text-slate-500 mb-4">{message}</p>
      {action}
    </div>
  );
}
