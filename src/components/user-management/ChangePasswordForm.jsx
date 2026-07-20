import { PASSWORD_HINT } from './helpers';
import { useT } from '@/lib/i18n/I18nContext';

export default function ChangePasswordForm({ passwordForm, setPasswordForm, onSubmit }) {
  const { t: _t } = useT();
  return (
    <form onSubmit={onSubmit} className="p-5 bg-card border border-border rounded-xl">
      <h3 className="font-semibold text-foreground mb-3">{_t('userManagement.change')}</h3>
      <div className="grid grid-cols-3 gap-3">
        <input
          type="password"
          placeholder={_t('userManagement.current')}
          value={passwordForm.current_password}
          onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
          required
          className="px-3 py-2 border border-border rounded-lg text-sm"
        />
        <input
          type="password"
          placeholder={_t('userManagement.new')}
          value={passwordForm.new_password}
          onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
          required
          className="px-3 py-2 border border-border rounded-lg text-sm"
        />
        <input
          type="password"
          placeholder={_t('userManagement.confirm')}
          value={passwordForm.confirm}
          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
          required
          className="px-3 py-2 border border-border rounded-lg text-sm"
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{PASSWORD_HINT}</p>
      <button
        type="submit"
        className="mt-3 px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:bg-foreground/90"
      >
        {_t('userManagement.update')}
      </button>
    </form>
  );
}
