import { Users, KeyRound } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

export default function Tabs({ tab, setTab }) {
  const { t: _t } = useT();
  return (
    <div className="flex items-center border-b border-border gap-0">
      <button
        onClick={() => setTab('users')}
        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
          tab === 'users'
            ? 'border-blue-600 text-blue-600 dark:text-blue-300'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
        }`}
      >
        <Users className="w-4 h-4" />
        {_t('userManagement.users_2')}
      </button>
      <button
        onClick={() => setTab('permissions')}
        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
          tab === 'permissions'
            ? 'border-blue-600 text-blue-600 dark:text-blue-300'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
        }`}
      >
        <KeyRound className="w-4 h-4" />
        {_t('userManagement.permissions')}
      </button>
    </div>
  );
}
