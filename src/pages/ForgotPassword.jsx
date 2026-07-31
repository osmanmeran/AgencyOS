import { useState } from 'react';
import { useT } from '@/lib/i18n/I18nContext';

export default function ForgotPassword() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const db = globalThis.__B44_DB__;
      await db.auth.forgotPassword(email.trim());
      // Always show the same confirmation, whether or not the email is
      // actually registered — the server responds identically either way so
      // this can't be used to test which emails exist.
      setSubmitted(true);
    } catch (err) {
      setError(err.message || t('auth.forgotPassword.errGeneric'));
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
          <h1 className="text-2xl font-bold text-foreground">{t('auth.forgotPassword.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('auth.forgotPassword.subtitle')}</p>
        </div>

        {submitted ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-muted-foreground mb-6">{t('auth.forgotPassword.checkEmailBody')}</p>
            <a href="/mock-login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-sm">
              {t('auth.forgotPassword.backToLogin')}
            </a>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('common.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-foreground hover:bg-foreground/90 disabled:bg-muted text-background text-sm font-medium rounded-lg transition-all"
              >
                {loading ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.submit')}
              </button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
              <a href="/mock-login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                {t('auth.forgotPassword.backToLogin')}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
