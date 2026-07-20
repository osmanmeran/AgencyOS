import { useState, useRef, useEffect } from 'react';
import { isMicrosoftSsoConfigured, signupWithMicrosoft } from '@/lib/microsoft-auth';

// Public, pre-auth workspace self-serve signup (Phase 3). Posts directly to
// /api/tenants/signup (which is CSRF-exempt, like login) and, on success,
// redirects to the new workspace URL. No existing session is required.
export default function Signup() {
  const [agencyName, setAgencyName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slugState, setSlugState] = useState({ status: 'idle', message: '' });
  const slugTimer = useRef(null);

  const msConfigured = isMicrosoftSsoConfigured();

  const slugify = (name) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);

  const onAgencyChange = (v) => {
    setAgencyName(v);
    // Only auto-fill the slug until the user edits it manually.
    if (!slug || slug === slugify(agencyName)) setSlug(slugify(v));
  };

  useEffect(() => {
    if (!slug) {
      setSlugState({ status: 'idle', message: '' });
      return undefined;
    }
    clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tenants/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.available) setSlugState({ status: 'ok', message: 'Available' });
        else if (data.reason === 'taken') setSlugState({ status: 'error', message: 'That address is already taken' });
        else setSlugState({ status: 'error', message: 'Use lowercase letters, numbers, and hyphens only' });
      } catch {
        setSlugState({ status: 'idle', message: '' });
      }
    }, 350);
    return () => clearTimeout(slugTimer.current);
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tenants/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName,
          slug,
          adminName: adminName || undefined,
          adminEmail,
          adminPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error?.message || 'Sign-up failed. Please try again.');
        setLoading(false);
        return;
      }
      // The response sets the auth cookies; navigate to the new workspace.
      window.location.href = data.workspaceUrl || '/';
    } catch (err) {
      setError(err.message || 'Sign-up failed. Please try again.');
      setLoading(false);
    }
  };

  const handleMicrosoftSignup = async () => {
    setError('');
    if (!agencyName || !slug) {
      setError('Enter your agency name and workspace address first.');
      return;
    }
    if (slugState.status === 'error') {
      setError('Choose a valid, available workspace address first.');
      return;
    }
    try {
      await signupWithMicrosoft(window.location.pathname, { agencyName, slug, adminName });
    } catch (err) {
      setError(err.message || 'Could not start Microsoft sign-up.');
    }
  };

  const slugHintColor =
    slugState.status === 'ok'
      ? 'text-green-600 dark:text-green-400'
      : slugState.status === 'error'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-blue-50 dark:via-blue-950/40 to-muted">
      <div className="bg-card rounded-2xl shadow-xl border border-border p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create your workspace</h1>
          <p className="text-muted-foreground mt-1">Set up a dedicated Marvelops workspace for your agency</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Agency name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => onAgencyChange(e.target.value)}
              placeholder="Acme Travel"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Workspace address</label>
            <div className="flex items-stretch">
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="acme"
                className="w-full px-3 py-2.5 border border-border rounded-l-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                required
              />
              <span className="flex items-center px-3 bg-muted border border-l-0 border-border rounded-r-lg text-sm text-muted-foreground whitespace-nowrap">
                .marvelops.app
              </span>
            </div>
            {slug && (
              <p className={`text-xs mt-1 ${slugHintColor}`}>
                {slugState.status === 'ok' ? `✓ ${slugState.message} — ${slug}.marvelops.app` : slugState.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Your name (optional)</label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin email</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="you@agency.com"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
            <p className="text-xs mt-1 text-muted-foreground">
              Min 8 characters, with uppercase, lowercase, and a number.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || slugState.status === 'error'}
            className="w-full py-2.5 bg-foreground hover:bg-foreground/90 disabled:bg-muted text-background text-sm font-medium rounded-lg transition-all"
          >
            {loading ? 'Creating workspace…' : 'Create workspace'}
          </button>
        </form>

        {msConfigured && (
          <>
            <div className="relative mb-6 mt-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <button
              onClick={handleMicrosoftSignup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 border-2 border-border hover:bg-muted disabled:opacity-50 text-foreground font-medium rounded-xl transition-all"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Sign up with Microsoft
            </button>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have a workspace?{' '}
          <a href="/mock-login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
