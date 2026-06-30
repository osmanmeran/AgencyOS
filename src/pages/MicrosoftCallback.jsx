import { useEffect, useState } from 'react';
import { handleMicrosoftCallback, exchangeIdTokenWithServer } from '@/lib/microsoft-auth';

export default function MicrosoftCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { idToken, returnUrl } = await handleMicrosoftCallback();
        if (cancelled) return;

        await exchangeIdTokenWithServer(idToken);
        if (cancelled) return;

        window.location.href = returnUrl;
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Login Microsoft fallito.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Login fallito</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <a href="/mock-login" className="inline-block px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">
            Torna al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-slate-500">Accesso in corso...</p>
      </div>
    </div>
  );
}
