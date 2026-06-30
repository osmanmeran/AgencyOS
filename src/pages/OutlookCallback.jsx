import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

// const db = globalThis.__B44_DB__;

export default function OutlookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      return;
    }

    if (!code) {
      setStatus('error');
      return;
    }

    // Verify state matches (CSRF protection)
    const savedState = sessionStorage.getItem('outlook_oauth_state');
    if (state && savedState && state !== savedState) {
      setStatus('error');
      return;
    }

    const codeVerifier = sessionStorage.getItem('outlook_oauth_verifier');
    const redirectUri = sessionStorage.getItem('outlook_oauth_redirect');

    sessionStorage.removeItem('outlook_oauth_state');
    sessionStorage.removeItem('outlook_oauth_verifier');
    sessionStorage.removeItem('outlook_oauth_redirect');

    if (!codeVerifier || !redirectUri) {
      setStatus('error');
      return;
    }

    const token = localStorage.getItem('marvelops_token');
    fetch('/api/integrations/outlook/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
      credentials: 'include',
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
    })
      .then(r => r.json())
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
        {status === 'connecting' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Connecting Outlook...</h2>
            <p className="text-slate-500 mt-2">Completing the connection to your Microsoft account.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Outlook Connected!</h2>
            <p className="text-slate-500 mt-2">Your Outlook account is now linked. You can send emails directly from the app.</p>
            <button
              onClick={() => navigate('/AppSettings')}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Settings
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Connection Failed</h2>
            <p className="text-slate-500 mt-2">Could not connect your Outlook account. Please try again.</p>
            <button
              onClick={() => navigate('/AppSettings')}
              className="mt-6 px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
