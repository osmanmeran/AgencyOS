export function formatCurrency(amount, currency = 'USD') {
  if (amount == null || isNaN(amount)) return '$0.00';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatDate(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}

export function formatDateShort(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}

export function formatDateFull(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}
