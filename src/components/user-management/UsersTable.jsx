import { TIER_LABELS } from './helpers';
import { useT } from '@/lib/i18n/I18nContext';

export default function UsersTable({ users, currentUser, allClients, deptColor, onEdit, onDelete }) {
  const { t: _t } = useT();
  const visible = users.filter((u) => u.is_active || u.id === currentUser?.id);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* The rounded card clips with overflow-hidden, so the table needs its own
          scroll container — otherwise the last columns (Status, Actions) are
          unreachable on narrow screens instead of scrollable. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{_t('userManagement.name')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{_t('userManagement.email')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{_t('userManagement.tier')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                {_t('userManagement.departments')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{_t('userManagement.status')}</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">{_t('userManagement.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="border-b border-border hover:bg-muted">
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{u.name}</span>
                  {u.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-300">
                      {_t('userManagement.youMarker')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      TIER_LABELS[u.user_tier]?.color || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {u.user_tier}
                  </span>
                  {u.user_tier === 'client' && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {allClients.find((c) => c.id === u.client_id)?.name || 'unlinked'}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(u.departments || []).map((d) => {
                      return (
                        <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${deptColor(d)}`}>
                          {d}
                        </span>
                      );
                    })}
                    {(!u.departments || u.departments.length === 0) && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium ${
                      u.is_active ? 'text-green-600 dark:text-green-300' : 'text-red-500 dark:text-red-300'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(u)}
                    className="px-3 py-1 bg-card border border-border text-muted-foreground text-xs rounded hover:bg-muted mr-1"
                  >
                    {_t('common.edit')}
                  </button>
                  {u.id !== currentUser?.id && u.user_tier !== 'admin' && (
                    <button
                      onClick={() => onDelete(u)}
                      className="px-3 py-1 bg-card border border-red-200 dark:border-red-800 text-red-500 dark:text-red-300 text-xs rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      {_t('common.delete')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {_t('userManagement.no')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
