import { useEffect, useState } from 'react';

// Surfaces the workspace lifecycle state the server now enforces
// (server/middleware/tenantStatus.js). Without this, a suspended or lapsed
// workspace would just see every action fail with a generic error.
//
// Silent by design when there's nothing to say — including on the legacy
// single-tenant deployment, where /api/tenants/me has no registry row to return.
export default function WorkspaceStatusBanner() {
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tenants/me', { credentials: 'include' });
        if (!res.ok) return; // 401/404 -> nothing to show
        const data = await res.json();
        if (!cancelled) setWorkspace(data);
      } catch {
        // Network hiccup: a missing banner is better than a broken page.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const notice = workspace && bannerFor(workspace);
  if (!notice) return null;

  const palette =
    notice.tone === 'error'
      ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
      : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200';

  return (
    <div role="status" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${palette}`}>
      {notice.message}
    </div>
  );
}

/** @returns {{tone: 'error'|'warning', message: string}|null} */
function bannerFor(workspace) {
  if (workspace.status === 'suspended') {
    return {
      tone: 'error',
      message: 'This workspace is suspended. Data is safe, but changes are blocked — please contact support.',
    };
  }

  if (workspace.status !== 'trial' || !workspace.trialEndsAt) return null;

  const endsAt = Date.parse(workspace.trialEndsAt);
  if (!Number.isFinite(endsAt)) return null;

  const daysLeft = Math.ceil((endsAt - Date.now()) / 86400000);
  if (daysLeft <= 0) {
    return { tone: 'error', message: 'Your trial has ended. Upgrade to continue using the workspace.' };
  }
  // Stay quiet until the deadline is close enough to act on.
  if (daysLeft > 7) return null;
  return {
    tone: 'warning',
    message: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade to keep access.`,
  };
}
