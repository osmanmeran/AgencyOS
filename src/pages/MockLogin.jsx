import React, { useState, useEffect } from 'react';
import { useDb } from '@/lib/DbContext';
import {
  isMicrosoftSsoConfigured,
  handleMicrosoftRedirect,
  loginWithMicrosoft,
  getMicrosoftReturnUrl,
  exchangeIdToken
} from '@/lib/microsoft-auth';

export default function MockLogin() {
  const db = useDb();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
//   const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const msConfigured = isMicrosoftSsoConfigured();
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Grab the returnUrl from query params (set by AuthContext/ApiClient redirect)
  // before Microsoft overwrites the URL
  const initialReturnUrl = React.useMemo(() => {
    return new URLSearchParams(window.location.search).get('returnUrl') || '/';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idToken = await handleMicrosoftRedirect();
        if (!idToken) return;
        if (cancelled) return;

        // Clear the OAuth params from the URL so the code can't be reused
        window.history.replaceState({}, document.title, '/mock-login');

        setLoading(true);
        setError('');
        if (typeof db.auth.microsoftLogin === 'function') {
          await db.auth.microsoftLogin(idToken);
        } else {
          await exchangeIdToken(idToken);
        }
        if (cancelled) return;
        const returnUrl = getMicrosoftReturnUrl();
        window.location.href = returnUrl;
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Microsoft login failed');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleMicrosoftLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithMicrosoft(initialReturnUrl);
    } catch (err) {
      setError(err.message || 'Microsoft login failed');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Marvelops TravelPro</h1>
          <p className="text-slate-500 mt-1">Sign in to your account</p>
        </div>

        {!isLocalhost && msConfigured && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
            Access via <strong>http://localhost:5173</strong> for Microsoft login to work.
            The registered redirect URI must match your browser address.
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
        )}

        {msConfigured && (
          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium rounded-xl transition-all mb-6"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Microsoft'}
          </button>
        )}

        {msConfigured && <div className="relative mb-6"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div><div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-400">or</span></div></div>}

        <form onSubmit={handleAdminLogin} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
            <input
              type="email"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="admin@travelpro.com"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-lg transition-all">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {!msConfigured && (
          <div className="mt-6 text-center">
            <div className="text-xs text-slate-400">
              <details>
                <summary className="cursor-pointer hover:text-slate-600 font-medium">Configure Microsoft SSO</summary>
                <div className="mt-2 p-3 bg-slate-50 rounded-lg text-slate-700 text-left space-y-3">
                  <p className="font-semibold text-slate-800">Step 1: Register an app in Azure</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Go to <a className="text-blue-600 underline" href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps" target="_blank" rel="noreferrer">Azure Portal &rarr; App registrations</a></li>
                    <li>Click <strong>+ New registration</strong></li>
                    <li>Enter a name (e.g. <em>Marvelops TravelPro</em>)</li>
                    <li>Under <strong>Supported account types</strong>, select <em>Accounts in any organizational directory (Any Microsoft ID tenant) and personal Microsoft accounts</em></li>
                    <li>Under <strong>Redirect URI</strong>, select <em>Single-page application (SPA)</em> and enter:<br/>
                      <code className="bg-slate-200 px-1 rounded text-xs break-all">http://localhost:5173/mock-login/</code></li>
                    <li>Click <strong>Register</strong></li>
                  </ol>
                  <p className="font-semibold text-slate-800">Step 2: Copy the Client ID</p>
                  <p className="ml-4">Find <strong>Application (client) ID</strong> on the Overview page.</p>
                  <p className="font-semibold text-slate-800">Step 3: Update .env</p>
                  <pre className="ml-4 p-2 bg-slate-800 text-green-300 rounded text-xs leading-relaxed">VITE_MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_ID=your-client-id</pre>
                  <p className="font-semibold text-slate-800">Step 4: Restart both servers</p>
                  <pre className="ml-4 p-2 bg-slate-800 text-green-300 rounded text-xs">npm start</pre>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
