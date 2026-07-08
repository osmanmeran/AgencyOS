import { useT } from '@/lib/i18n/I18nContext';

const UserNotRegisteredError = () => {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-card to-muted">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-lg border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100 dark:bg-orange-900/40">
            <svg
              className="w-8 h-8 text-orange-600 dark:text-orange-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">{t('userNotRegistered.title')}</h1>
          <p className="text-muted-foreground mb-8">{t('userNotRegistered.body')}</p>
          <div className="p-4 bg-muted rounded-md text-sm text-muted-foreground">
            <p>{t('userNotRegistered.believeErrorIntro')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>{t('userNotRegistered.verifyAccount')}</li>
              <li>{t('userNotRegistered.contactAdmin')}</li>
              <li>{t('userNotRegistered.tryLoggingOut')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
