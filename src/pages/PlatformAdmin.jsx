import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';

// Platform (SaaS operator) admin dashboard (Phase 5). Lists every workspace
// with aggregated stats. Access is gated server-side by PLATFORM_ADMIN_EMAILS;
// non-admins receive a 403 and see the not-authorized message below.
export default function PlatformAdmin() {
  const { request } = useApi();
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Workspace id currently mid-action, so its buttons can be disabled.
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [ws, st] = await Promise.all([request('/api/platform/workspaces'), request('/api/platform/stats')]);
        setWorkspaces(ws.workspaces || []);
        setStats(st);
      } catch (err) {
        setError(err.message || 'Failed to load platform data');
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
      setActionError(err.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading platform…</div>;
  }

  if (error) {
    const notAuthorized = /platform admin/i.test(error);
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Platform admin</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {notAuthorized
            ? 'You do not have platform admin access. Contact the SaaS operator to be added to PLATFORM_ADMIN_EMAILS.'
            : error}
        </p>
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
      <h1 className="text-2xl font-semibold text-foreground">Platform admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Cross-tenant overview of all workspaces.</p>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card label="Workspaces" value={stats.workspaceCount} />
          <Card label="Total users" value={stats.totalUsers} />
          <Card label="Total records" value={stats.totalEntities} />
          <Card label="Active" value={stats.byStatus?.active || 0} />
        </div>
      )}

      {actionError && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {actionError}
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Trial ends</th>
              <th className="px-4 py-3 text-right font-medium">Users</th>
              <th className="px-4 py-3 text-right font-medium">Records</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  No workspaces yet.
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
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColor(w.status)}`}
                  >
                    {w.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <TrialCell trialEndsAt={w.trialEndsAt} status={w.status} />
                </td>
                <td className="px-4 py-3 text-right text-foreground">{w.userCount}</td>
                <td className="px-4 py-3 text-right text-foreground">{w.entityCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {w.createdDate ? new Date(w.createdDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {w.status === 'suspended' ? (
                      <ActionButton
                        disabled={busyId === w.id}
                        onClick={() => runAction(w.id, '/status', { status: 'active' })}
                      >
                        Reactivate
                      </ActionButton>
                    ) : (
                      <>
                        {w.status === 'trial' && (
                          <>
                            <ActionButton
                              disabled={busyId === w.id}
                              onClick={() => runAction(w.id, '/extend-trial', {})}
                            >
                              Extend trial
                            </ActionButton>
                            <ActionButton
                              disabled={busyId === w.id}
                              onClick={() => runAction(w.id, '/status', { status: 'active' })}
                            >
                              Mark paid
                            </ActionButton>
                          </>
                        )}
                        <ActionButton
                          disabled={busyId === w.id}
                          variant="danger"
                          onClick={() => runAction(w.id, '/status', { status: 'suspended' })}
                        >
                          Suspend
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

/** Trial deadline cell: only meaningful while a workspace is still on trial. */
function TrialCell({ trialEndsAt, status }) {
  if (status !== 'trial' || !trialEndsAt) return <span>—</span>;
  const ends = new Date(trialEndsAt);
  const daysLeft = Math.ceil((ends.getTime() - Date.now()) / 86400000);
  if (daysLeft <= 0) return <span className="font-medium text-red-600 dark:text-red-400">Expired</span>;
  return (
    <span className={daysLeft <= 3 ? 'font-medium text-amber-600 dark:text-amber-400' : undefined}>
      {ends.toLocaleDateString()} ({daysLeft}d)
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
