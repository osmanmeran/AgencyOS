import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { useT } from '@/lib/i18n/I18nContext';

// Platform (SaaS operator) admin dashboard (Phase 5). Lists every workspace
// with aggregated stats. Access is gated server-side by PLATFORM_ADMIN_EMAILS;
// non-admins receive a 403 and see the not-authorized message below.
export default function PlatformAdmin() {
  const { t } = useT();
  const { request } = useApi();
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Workspace id currently mid-action, so its buttons can be disabled.
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [ws, st] = await Promise.all([request('/api/platform/workspaces'), request('/api/platform/stats')]);
        setWorkspaces(ws.workspaces || []);
        setStats(st);
      } catch (err) {
        setError(err.message || t('platformAdmin.loadErr'));
      } finally {
        setLoading(false);
      }
    })();
  }, [request]);

  // Apply a lifecycle action, then merge the returned row back into the table
  // (the response is the source of truth — e.g. activating clears trialEndsAt).
  async function runAction(id, path, body) {
    setBusyId(id);
    setActionError('');
    try {
      const res = await request(`/api/platform/workspaces/${id}${path}`, {
        method: path === '/status' ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, ...res.workspace } : w)));
    } catch (err) {
      setActionError(err.message || t('platformAdmin.actionFailed'));
    } finally {
      setBusyId(null);
    }
  }

  async function rename(workspace) {
    const name = window.prompt(t('platformAdmin.renamePromptTitle'), workspace.name);
    if (!name || name === workspace.name) return;
    setBusyId(workspace.id);
    setActionError('');
    try {
      const res = await request(`/api/platform/workspaces/${workspace.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setWorkspaces((prev) => prev.map((w) => (w.id === workspace.id ? { ...w, ...res.workspace } : w)));
    } catch (err) {
      setActionError(err.message || t('platformAdmin.renameErr'));
    } finally {
      setBusyId(null);
    }
  }

  // Irreversible, so the UI asks for the same confirmation the API enforces:
  // the workspace must already be suspended, and the operator types its address.
  async function destroy(workspace) {
    const typed = window.prompt(t('platformAdmin.deletePromptBody', { name: workspace.name, slug: workspace.slug }));
    if (typed === null) return;
    setBusyId(workspace.id);
    setActionError('');
    try {
      const res = await request(`/api/platform/workspaces/${workspace.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmSlug: typed.trim() }),
      });
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspace.id));
      setNotice(t('platformAdmin.deletedNotice', { name: res.deleted.name, snapshot: res.snapshot }));
    } catch (err) {
      setActionError(err.message || t('platformAdmin.deleteErr'));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">{t('platformAdmin.loading')}</div>
    );
  }

  if (error) {
    const notAuthorized = /platform admin/i.test(error);
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">{t('platformAdmin.title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{notAuthorized ? t('platformAdmin.notAuthorized') : error}</p>
      </div>
    );
  }

  const statusColor = (s) =>
    s === 'active'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : s === 'suspended'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">{t('platformAdmin.title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('platformAdmin.subtitle')}</p>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card label={t('platformAdmin.cardWorkspaces')} value={stats.workspaceCount} />
          <Card label={t('platformAdmin.cardTotalUsers')} value={stats.totalUsers} />
          <Card label={t('platformAdmin.cardTotalRecords')} value={stats.totalEntities} />
          <Card label={t('platformAdmin.cardActive')} value={stats.byStatus?.active || 0} />
        </div>
      )}

      {stats?.backups && <BackupHealth health={stats.backups} t={t} />}

      {actionError && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {actionError}
        </div>
      )}

      {notice && (
        <div className="mt-6 break-all rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('platformAdmin.colWorkspace')}</th>
              <th className="px-4 py-3 font-medium">{t('platformAdmin.colAddress')}</th>
              <th className="px-4 py-3 font-medium">{t('platformAdmin.colStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('platformAdmin.colTrialEnds')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('platformAdmin.colUsers')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('platformAdmin.colRecords')}</th>
              <th className="px-4 py-3 font-medium">{t('platformAdmin.colCreated')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('platformAdmin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {t('platformAdmin.noWorkspaces')}
                </td>
              </tr>
            )}
            {workspaces.map((w) => (
              <tr key={w.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <code className="rounded bg-muted px-1.5 py-0.5">{w.slug}</code>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(w.status)}`}>
                    {t(`workspaceStatus.${w.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <TrialCell trialEndsAt={w.trialEndsAt} status={w.status} t={t} />
                </td>
                <td className="px-4 py-3 text-right text-foreground">{w.userCount}</td>
                <td className="px-4 py-3 text-right text-foreground">{w.entityCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {w.createdDate ? new Date(w.createdDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <ActionButton disabled={busyId === w.id} onClick={() => rename(w)}>
                      {t('platformAdmin.actionRename')}
                    </ActionButton>
                    {w.status === 'suspended' ? (
                      <>
                        <ActionButton
                          disabled={busyId === w.id}
                          onClick={() => runAction(w.id, '/status', { status: 'active' })}
                        >
                          {t('platformAdmin.actionReactivate')}
                        </ActionButton>
                        <ActionButton disabled={busyId === w.id} variant="danger" onClick={() => destroy(w)}>
                          {t('platformAdmin.actionDelete')}
                        </ActionButton>
                      </>
                    ) : (
                      <>
                        {w.status === 'trial' && (
                          <>
                            <ActionButton
                              disabled={busyId === w.id}
                              onClick={() => runAction(w.id, '/extend-trial', {})}
                            >
                              {t('platformAdmin.actionExtendTrial')}
                            </ActionButton>
                            <ActionButton
                              disabled={busyId === w.id}
                              onClick={() => runAction(w.id, '/status', { status: 'active' })}
                            >
                              {t('platformAdmin.actionMarkPaid')}
                            </ActionButton>
                          </>
                        )}
                        <ActionButton
                          disabled={busyId === w.id}
                          variant="danger"
                          onClick={() => runAction(w.id, '/status', { status: 'suspended' })}
                        >
                          {t('platformAdmin.actionSuspend')}
                        </ActionButton>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Backup health. Loud when a successful run has gone missing entirely — that's
 * the case no per-run alert can report, because a scheduler that died sends
 * nothing at all.
 */
function BackupHealth({ health, t }) {
  const { lastRunAt, lastSuccessAt, stale, failed, total, offsite, failures } = health;
  const bad = stale || failed > 0;
  const palette = bad
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
    : 'border-border bg-card text-foreground';

  const when = (iso) => (iso ? new Date(iso).toLocaleString() : t('platformAdmin.backupsNever'));

  return (
    <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${palette}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{t('platformAdmin.backupsTitle')}</span>
        <span className="text-xs">
          {offsite ? t('platformAdmin.backupsOffsiteOn') : t('platformAdmin.backupsOffsiteOff')}
        </span>
      </div>
      <p className="mt-1">
        {t('platformAdmin.backupsSummary', { lastRun: when(lastRunAt), lastSuccess: when(lastSuccessAt) })}
        {total > 0 && ` · ${t('platformAdmin.backupsTargetsOk', { ok: total - failed, total })}`}
      </p>
      {stale && <p className="mt-1 font-medium">{t('platformAdmin.backupsStale')}</p>}
      {failures?.length > 0 && (
        <ul className="mt-2 list-inside list-disc">
          {failures.map((f) => (
            <li key={f.scope}>
              {f.label || f.scope}: {f.error || 'unknown error'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Trial deadline cell: only meaningful while a workspace is still on trial. */
function TrialCell({ trialEndsAt, status, t }) {
  if (status !== 'trial' || !trialEndsAt) return <span>—</span>;
  const ends = new Date(trialEndsAt);
  const daysLeft = Math.ceil((ends.getTime() - Date.now()) / 86400000);
  if (daysLeft <= 0)
    return <span className="font-medium text-red-600 dark:text-red-400">{t('platformAdmin.trialExpired')}</span>;
  return (
    <span className={daysLeft <= 3 ? 'font-medium text-amber-600 dark:text-amber-400' : undefined}>
      {ends.toLocaleDateString()} ({t('platformAdmin.trialDays', { days: daysLeft })})
    </span>
  );
}

function ActionButton({ children, onClick, disabled, variant = 'default' }) {
  const base = 'rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50';
  const styles =
    variant === 'danger'
      ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40'
      : 'border-border text-foreground hover:bg-muted';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Card({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
