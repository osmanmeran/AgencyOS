import { useT } from '@/lib/i18n/I18nContext';
export default function DeleteConfirmModal({ confirmDelete, setConfirmDelete, onDelete }) {
  const { t: _t } = useT();
  if (!confirmDelete) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={() => setConfirmDelete(null)}
    >
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-foreground mb-2">{_t('userManagement.delete_2')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {_t('userManagement.are')} <strong>{confirmDelete.name}</strong> ({confirmDelete.email})?{' '}
          {_t('userManagement.thisCannot')}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            {_t('userManagement.cancel')}
          </button>
          <button
            onClick={() => onDelete(confirmDelete.id)}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            {_t('userManagement.delete_2')}
          </button>
        </div>
      </div>
    </div>
  );
}
