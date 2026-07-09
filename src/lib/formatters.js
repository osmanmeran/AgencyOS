import { getCurrencySymbol } from './currencies';

/** Formats a number as localized currency (e.g. `$1,234.56`), falling back to a plain `CUR amount` string for unsupported currency codes. */
export function formatCurrency(amount, currency = 'USD') {
  if (amount == null || isNaN(amount)) return '$0.00';
  const symbol = getCurrencySymbol(currency);
  const num = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
  return `${symbol}${num}`;
}

/** Formats a date as e.g. `Jan 5, 2026`. */
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

/** Formats a date as e.g. `Jan 5` (no year). */
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

/** Formats a date as e.g. `Monday, January 5, 2026`. */
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
