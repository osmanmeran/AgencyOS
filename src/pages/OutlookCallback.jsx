import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function OutlookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setErrorMsg(searchParams.get('error_description') || error);
      setStatus('error');
      return;
    }

    if (!code) {
      setStatus('error');
      return;
    }

    const savedState = sessionStorage.getItem('outlook_oauth_state');
    if (state && savedState && state !== savedState) {
      setErrorMsg('State mismatch — possible CSRF attack');
      setStatus('error');
      return;
    }

    const codeVerifier = sessionStorage.getItem('outlook_oauth_verifier');
    const redirectUri = sessionStorage.getItem('outlook_oauth_redirect');
    const tenantId = sessionStorage.getItem('outlook_oauth_tenant') || 'common';
    const clientId = sessionStorage.getItem('outlook_oauth_client_id') || import.meta.env.VITE_MICROSOFT_CLIENT_ID;

    sessionStorage.removeItem('outlook_oauth_state');
    sessionStorage.removeItem('outlook_oauth_verifier');
    sessionStorage.removeItem('outlook_oauth_redirect');
    sessionStorage.removeItem('outlook_oauth_tenant');
    sessionStorage.removeItem('outlook_oauth_client_id');

    if (!codeVerifier || !redirectUri) {
      setErrorMsg('Missing PKCE verifier — please try again');
      setStatus('error');
      return;
    }

    // Exchange the code in the browser (required for SPA app type in Azure)
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
    });

    fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || data.error) {
          const msg = data.error_description || (typeof data.error === 'string' ? data.error : data.error?.message) || 'Token exchange failed';
          throw new Error(msg);
        }
        return data;
      })
      .then(async (tokenData) => {
        const r = await fetch('/api/integrations/outlook/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token_data: tokenData }),
        });
        const data = await r.json();
        if (!r.ok || data?.error) {
          const msg = data?.message || (typeof data?.error === 'string' ? data.error : data?.error?.message) || 'Failed to save connection';
          throw new Error(msg);
        }
        setStatus('success');
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Connection failed');
        setStatus('error');
      });
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
            <p className="text-slate-500 mt-2">{errorMsg || 'Could not connect your Outlook account. Please try again.'}</p>
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
