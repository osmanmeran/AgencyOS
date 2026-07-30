import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/i18n/I18nContext';

// Workspace self-service control plane (Phase 4). Lets a workspace admin edit
// the workspace display name and configure the Azure tenant used for Microsoft
// SSO login. Members can view the current settings; only admins can change them.
export default function WorkspaceSettings() {
  const { t, language } = useT();
  const { user } = useAuth();
  const { request } = useApi();
  const isAdmin = user?.user_tier === 'admin';

  const [state, setState] = useState(null);
  const [form, setForm] = useState({ name: '', azureTenantId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await request('/api/tenants/me');
        setState(data);
        setForm({ name: data.name || '', azureTenantId: data.azureTenantId || '' });
      } catch (err) {
        setError(err.message || t('workspaceSettings.errLoad'));
      } finally {
        setLoading(false);
      }
    })();
  }, [request]);

  const handleChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setMessage('');
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await request('/api/tenants/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          azureTenantId: form.azureTenantId,
        }),
      });
      setState(updated);
      setForm({ name: updated.name || '', azureTenantId: updated.azureTenantId || '' });
      setMessage(t('workspaceSettings.saved'));
    } catch (err) {
      setError(err.message || t('workspaceSettings.errSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t('workspaceSettings.loading')}
      </div>
    );
  }

  const statusColor =
    state?.status === 'active'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : state?.status === 'suspended'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">{t('workspaceSettings.title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('workspaceSettings.subtitle')}</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
          {message}
        </div>
      )}

      <div className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="block text-sm font-medium text-foreground">{t('workspaceSettings.addressLabel')}</label>
          <p className="mt-1 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5">{state?.slug}</code>
            {state?.slug && <span className="ml-1">.marvelops.app</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('workspaceSettings.addressImmutable')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">{t('workspaceSettings.statusLabel')}</label>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            {state?.status ? t(`workspaceStatus.${state.status}`) : ''}
          </span>
          {state?.status === 'trial' && state?.trialEndsAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('workspaceSettings.trialEnds', { date: new Date(state.trialEndsAt).toLocaleDateString(language) })}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ws-name" className="block text-sm font-medium text-foreground">
            {t('workspaceSettings.nameLabel')}
          </label>
          <input
            id="ws-name"
            type="text"
            value={form.name}
            disabled={!isAdmin}
            onChange={handleChange('name')}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-blue-500 disabled:opacity-60"
            placeholder={t('workspaceSettings.namePlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="ws-azure" className="block text-sm font-medium text-foreground">
            {t('workspaceSettings.azureLabel')}
          </label>
          <input
            id="ws-azure"
            type="text"
            value={form.azureTenantId}
            disabled={!isAdmin}
            onChange={handleChange('azureTenantId')}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-blue-500 disabled:opacity-60"
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          <p className="mt-1 text-xs text-muted-foreground">{t('workspaceSettings.azureHint')}</p>
        </div>

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t('workspaceSettings.saving') : t('workspaceSettings.saveChanges')}
          </button>
        )}
        {!isAdmin && <p className="text-xs text-muted-foreground">{t('workspaceSettings.adminOnly')}</p>}
      </div>
    </div>
  );
}
