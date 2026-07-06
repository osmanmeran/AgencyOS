import { toast } from 'sonner';

/** Shows a success toast. */
export function showSuccess(message, description) {
  toast.success(message, { description });
}

/** Shows an error toast. */
export function showError(message, description) {
  toast.error(message, { description });
}

/** Shows an informational toast. */
export function showInfo(message, description) {
  toast.info(message, { description });
}

/** Shows a warning toast. */
export function showWarning(message, description) {
  toast.warning(message, { description });
}

/** Shows a toast that tracks a promise's loading/success/error states. */
export function showPromise(promise, { loading, success, error }) {
  toast.promise(promise, { loading, success, error });
}
