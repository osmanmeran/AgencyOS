import { Button } from '@/components/ui/button';
import { CheckSquare } from 'lucide-react';

// Shared visual shell for a bulk-actions toolbar. Each page composes its own
// action buttons (export/delete/status-change) and passes them as children —
// this component only owns the count display and "deselect all".
export default function BulkActionsBar({ count, label, onDeselectAll, children }) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-5 h-5 text-blue-600" />
        <span className="font-medium text-blue-800">{count} {label}{count > 1 ? 's' : ''} selected</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDeselectAll}>
          Deselect All
        </Button>
        {children}
      </div>
    </div>
  );
}
