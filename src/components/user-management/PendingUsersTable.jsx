import { useT } from '@/lib/i18n/I18nContext';
export default function PendingUsersTable({ users, onApprove, onDeny }) {
  const { t: _t, language } = useT();
  const pending = users.filter((u) => !u.is_active);
  if (pending.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
        <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">{_t('userManagement.pending')}</h3>
        <span className="text-xs text-amber-600 dark:text-amber-300">
          ({pending.length} {_t('userManagement.users')}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-amber-100/50 dark:bg-amber-900/50">
            <th className="text-left px-4 py-2 font-medium text-amber-700 dark:text-amber-300">
              {_t('userManagement.name')}
            </th>
            <th className="text-left px-4 py-2 font-medium text-amber-700 dark:text-amber-300">
              {_t('userManagement.email')}
            </th>
            <th className="text-left px-4 py-2 font-medium text-amber-700 dark:text-amber-300">
              {_t('userManagement.signed')}
            </th>
            <th className="text-right px-4 py-2 font-medium text-amber-700 dark:text-amber-300">
              {_t('userManagement.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {pending.map((u) => (
            <tr key={u.id} className="border-b border-amber-100 hover:bg-amber-50/50 dark:hover:bg-amber-950/50">
              <td className="px-4 py-2.5 font-medium text-amber-900 dark:text-amber-300">{u.name}</td>
              <td className="px-4 py-2.5 text-amber-700 dark:text-amber-300">{u.email}</td>
              <td className="px-4 py-2.5 text-amber-600 dark:text-amber-300 text-xs">
                {u.created_date ? new Date(u.created_date).toLocaleDateString(language) : '-'}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => onApprove(u)}
                  className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 mr-1"
                >
                  {_t('userManagement.approve')}
                </button>
                <button
                  onClick={() => onDeny(u)}
                  className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                >
                  {_t('userManagement.deny')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
