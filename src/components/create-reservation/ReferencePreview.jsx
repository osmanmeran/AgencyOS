import { Hash } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

export default function ReferencePreview({ previewRef, isEditing }) {
  const { t: _t } = useT();
  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg flex items-center gap-2">
      <Hash className="w-4 h-4 text-blue-600 dark:text-blue-300" />
      <span className="text-sm text-blue-700 dark:text-blue-300">{_t('createReservation.reference')}</span>
      <span className="font-mono font-semibold text-blue-900 dark:text-blue-300">{previewRef}</span>
      <span className="text-xs text-blue-500 dark:text-blue-300 ml-auto">
        {isEditing ? '(existing reference)' : '(auto-generated on save)'}
      </span>
    </div>
  );
}
