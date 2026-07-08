import { Button } from '@/components/ui/button';
import { CheckSquare } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

// Shared visual shell for a bulk-actions toolbar. Each page composes its own
// action buttons (export/delete/status-change) and passes them as children —
// this component only owns the count display and "deselect all". Callers
// pass already-translated singular/plural nouns since pluralization rules
// aren't uniform across languages.
export default function BulkActionsBar({ count, labelSingular, labelPlural, onDeselectAll, children }) {
  const { t } = useT();
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl px-5 py-3">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        <span className="font-medium text-blue-800 dark:text-blue-300">
          {t('common.selectedCount', { count, label: count > 1 ? labelPlural : labelSingular })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDeselectAll}>
          {t('common.deselectAll')}
        </Button>
        {children}
      </div>
    </div>
  );
}
