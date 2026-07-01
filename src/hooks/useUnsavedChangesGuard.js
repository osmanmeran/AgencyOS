import { useEffect } from 'react';
import { registerDirtyGuard, unregisterDirtyGuard } from '@/lib/navigationGuard';

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave this page?';

// Warns before losing unsaved changes: native browser prompt for tab
// close/refresh/typing a new URL, and a confirm() dialog for in-app link
// clicks (via navigationGuard.js).
export function useUnsavedChangesGuard(isDirty, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    registerDirtyGuard(message);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unregisterDirtyGuard();
    };
  }, [isDirty, message]);
}
