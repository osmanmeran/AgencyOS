import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '@/lib/i18n/I18nContext';

export default function ResetPassword() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-blue-50 dark:via-blue-950/40 to-muted">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('auth.resetPassword.invalidLinkTitle')}</h1>
          <p className="text-muted-foreground mb-6">{t('auth.resetPassword.invalidLinkBody')}</p>
          <a href="/forgot-password" className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-sm">
            {t('auth.forgotPassword.title')}
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('auth.acceptInvite.errPasswordLength'));
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError(t('auth.acceptInvite.errPasswordUppercase'));
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError(t('auth.acceptInvite.errPasswordLowercase'));
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError(t('auth.acceptInvite.errPasswordNumber'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.acceptInvite.errPasswordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const db = globalThis.__B44_DB__;
      await db.auth.resetPassword({ token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      setError(err.message || t('auth.resetPassword.errGeneric'));
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-blue-50 dark:via-blue-950/40 to-muted">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('auth.resetPassword.successTitle')}</h1>
          <p className="text-muted-foreground mb-6">{t('auth.resetPassword.successBody')}</p>
          <a
            href="/mock-login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            {t('auth.resetPassword.goToLogin')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-blue-50 dark:via-blue-950/40 to-muted">
      <div className="bg-card rounded-2xl shadow-xl border border-border p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('auth.resetPassword.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('auth.resetPassword.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('auth.resetPassword.newPasswordLabel')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.acceptInvite.passwordPlaceholder')}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('auth.acceptInvite.confirmPasswordLabel')}
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t('auth.acceptInvite.confirmPasswordPlaceholder')}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-all"
          >
            {loading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
