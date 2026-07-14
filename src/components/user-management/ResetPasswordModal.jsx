import { Button } from '@/components/ui/button';

export default function ResetPasswordModal({
  resetPwdUser,
  setResetPwdUser,
  resetPwdResult,
  setResetPwdResult,
  resetPwdNew,
  setResetPwdNew,
  resetPwdConfirm,
  setResetPwdConfirm,
  resetPwdError,
  resetPwdSaving,
  onSubmit,
}) {
  if (!resetPwdUser) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={() => {
        setResetPwdUser(null);
        setResetPwdResult('');
      }}
    >
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {resetPwdResult ? (
          <>
            <h3 className="text-lg font-bold text-foreground mb-2">Password Reset Successfully</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share this new password with <strong>{resetPwdUser.name}</strong>:
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-center mb-4">
              <code className="text-lg font-mono font-bold text-foreground select-all">{resetPwdResult}</code>
            </div>
            <p className="text-xs text-red-600 dark:text-red-300 mb-4">
              Make sure to share this securely — it will not be shown again.
            </p>
            <Button
              onClick={() => {
                setResetPwdUser(null);
                setResetPwdResult('');
                setResetPwdNew('');
                setResetPwdConfirm('');
              }}
              className="w-full"
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-foreground mb-2">Reset Password: {resetPwdUser.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter a new password for this user. The password will be shown once after saving.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
                <input
                  type="text"
                  value={resetPwdNew}
                  onChange={(e) => setResetPwdNew(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  placeholder="At least 8 chars, uppercase, lowercase, number"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Confirm Password</label>
                <input
                  type="text"
                  value={resetPwdConfirm}
                  onChange={(e) => setResetPwdConfirm(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  placeholder="Re-enter the password"
                />
              </div>
              {resetPwdError && <p className="text-xs text-red-600 dark:text-red-300">{resetPwdError}</p>}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setResetPwdUser(null);
                  setResetPwdNew('');
                  setResetPwdConfirm('');
                }}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={resetPwdSaving}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {resetPwdSaving ? 'Saving...' : 'Set New Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
