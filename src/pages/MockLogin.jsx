import { useState } from 'react';
import { useDb } from '@/lib/DbContext';
import { isMicrosoftSsoConfigured, loginWithMicrosoft } from '@/lib/microsoft-auth';

export default function MockLogin() {
  const db = useDb();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const msConfigured = isMicrosoftSsoConfigured();
  const initialReturnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/';

  const handleMicrosoftLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithMicrosoft(initialReturnUrl);
    } catch (err) {
      setError(err.message || 'Login failed.');
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await db.auth.loginViaEmailPassword(adminEmail, adminPassword);
      window.location.href = initialReturnUrl;
    } catch (err) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-blue-50 dark:via-blue-950/40 to-muted">
      <div className="bg-card rounded-2xl shadow-xl border border-border p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Marvelops TravelPro</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {msConfigured && (
          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 border-2 border-border hover:border-border hover:bg-muted disabled:opacity-50 text-foreground font-medium rounded-xl transition-all mb-6"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Microsoft'}
          </button>
        )}

        {msConfigured && (
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@travelpro.com"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-foreground hover:bg-foreground/90 disabled:bg-muted text-background text-sm font-medium rounded-lg transition-all"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
