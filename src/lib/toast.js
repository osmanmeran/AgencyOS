import { toast } from 'sonner';

export function showSuccess(message, description) {
  toast.success(message, { description });
}

export function showError(message, description) {
  toast.error(message, { description });
}

export function showInfo(message, description) {
  toast.info(message, { description });
}

export function showWarning(message, description) {
  toast.warning(message, { description });
}

export function showPromise(promise, { loading, success, error }) {
  toast.promise(promise, { loading, success, error });
}
