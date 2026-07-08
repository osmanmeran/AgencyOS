import { useEffect, useState } from 'react';
import { handleMicrosoftCallback, exchangeIdTokenWithServer } from '@/lib/microsoft-auth';
import { useT } from '@/lib/i18n/I18nContext';

export default function MicrosoftCallback() {
  const { t } = useT();
  const [error, setError] = useState('');
  const [step, setStep] = useState(t('auth.microsoftCallback.verifyingCode'));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStep(t('auth.microsoftCallback.exchangingToken'));
        const { idToken, returnUrl } = await handleMicrosoftCallback();
        if (cancelled) return;

        setStep(t('auth.microsoftCallback.authenticatingServer'));
        await exchangeIdTokenWithServer(idToken);
        if (cancelled) return;

        setStep(t('auth.microsoftCallback.loginComplete'));
        window.location.href = returnUrl;
      } catch (err) {
        if (!cancelled) {
          setError(err.message || t('auth.login.errLoginFailedPeriod'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 w-full max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">{t('auth.microsoftCallback.loginFailedTitle')}</h2>
          <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-lg p-3 mb-6 text-left">
            {error}
          </p>
          <a
            href="/mock-login"
            className="inline-block px-4 py-2 bg-foreground text-background text-sm rounded-lg hover:bg-foreground/90"
          >
            {t('auth.microsoftCallback.backToLogin')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-border border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">{step}</p>
      </div>
    </div>
  );
}
