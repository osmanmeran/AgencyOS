import { TIERS, TIER_LABELS } from './helpers';
import ClientLinkPicker from '@/components/passengers/ClientLinkPicker';
import { useT } from '@/lib/i18n/I18nContext';

export default function InviteModal({
  showInvite,
  setShowInvite,
  inviteForm,
  setInviteForm,
  onSubmit,
  inviteResult,
  setInviteResult,
  inviteLoading,
  managers,
}) {
  const { t: _t } = useT();
  if (!showInvite) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={() => {
        setShowInvite(false);
        setInviteResult(null);
      }}
    >
      <div className="bg-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-foreground mb-4">{_t('userManagement.invite')}</h3>
        {inviteResult ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-700 dark:text-green-300 font-medium">{_t('userManagement.invitation')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {inviteResult.email} {_t('userManagement.will')}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              {_t('userManagement.inviteLink')}{' '}
              <span className="font-mono text-blue-600 dark:text-blue-300">
                {window.location.origin}/accept-invite?token={inviteResult.token}
              </span>
            </p>
            <button
              onClick={() => {
                setShowInvite(false);
                setInviteResult(null);
              }}
              className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {_t('userManagement.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{_t('userManagement.email_2')}</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder={_t('userManagement.colleague')}
                required
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {_t('userManagement.name')}{' '}
                <span className="text-xs text-muted-foreground font-normal">{_t('userManagement.optionalUser')}</span>
              </label>
              <input
                type="text"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder={_t('userManagement.jane')}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {_t('userManagement.userTier_2')}
              </label>
              <select
                value={inviteForm.user_tier}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, user_tier: e.target.value, client_id: '', client_name: '' })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABELS[t]?.label || t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {inviteForm.user_tier === 'client' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{_t('userManagement.linked')}</label>
                <ClientLinkPicker
                  clientId={inviteForm.client_id}
                  clientName={inviteForm.client_name}
                  onSelect={(c) => setInviteForm({ ...inviteForm, client_id: c.id, client_name: c.name })}
                  onClear={() => setInviteForm({ ...inviteForm, client_id: '', client_name: '' })}
                />
                <p className="text-xs text-muted-foreground mt-1">{_t('userManagement.the')}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{_t('userManagement.reportsTo')}</label>
              <select
                value={inviteForm.manager_id}
                onChange={(e) => setInviteForm({ ...inviteForm, manager_id: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="">{_t('userManagement.reportsToNone')}</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({TIER_LABELS[m.user_tier]?.label || m.user_tier})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowInvite(false);
                  setInviteResult(null);
                }}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                {_t('userManagement.cancel')}
              </button>
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400"
              >
                {inviteLoading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
