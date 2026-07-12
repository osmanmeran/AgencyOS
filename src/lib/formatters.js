// Single source of truth for currency display symbols. Kept here (a widely
// shared, non-lazy-split module) so the binding is never placed in a lazily
// loaded route chunk — referencing it from two different lazy route chunks
// would let Rollup move it into one of them, leaving the other with a
// temporal-dead-zone reference at render time.
const CURATED_CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  TRY: '₺',
  AED: 'د.إ',
  SAR: '﷼',
  EGP: 'E£',
  MAD: 'MAD',
  JPY: '¥',
  CHF: 'CHF',
  CAD: 'CA$',
  AUD: 'A$',
};

/** Returns the best display symbol for a currency code, never a wrong one. */
export function getCurrencySymbol(code) {
  if (!code) return '';
  const cur = String(code).toUpperCase();
  if (CURATED_CURRENCY_SYMBOLS[cur]) return CURATED_CURRENCY_SYMBOLS[cur];
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const symbol = parts.find((p) => p.type === 'currency')?.value;
    if (symbol && symbol !== cur) return symbol;
  } catch {
    /* fall through */
  }
  return cur;
}

/** Alias used by legacy call sites: sym(currency). */
export const sym = (code) => getCurrencySymbol(code);

export const CURRENCY_SYMBOLS = CURATED_CURRENCY_SYMBOLS;

/**
 * Picks a representative currency across a set of records that can each
 * carry their own currency (proposal services, cart items, pricing tiers),
 * and discloses the rest when they differ rather than silently labeling a
 * mixed-currency total with one (possibly wrong) symbol. Uses the first
 * currency encountered, in record order — deterministic, and consistent
 * with how these totals are otherwise built up (first line first).
 * @param {any[]} records
 * @param {string} currencyKey - property name holding each record's currency code
 */
export function mixedCurrencyLabel(records, currencyKey) {
  const currencies = [...new Set((records || []).map((r) => r?.[currencyKey]).filter(Boolean))];
  const primary = currencies[0] || 'USD';
  const symbol = getCurrencySymbol(primary);
  const isMixed = currencies.length > 1;
  return {
    symbol,
    currencies,
    isMixed,
    label: isMixed ? `${symbol} (${currencies.join('/')})` : symbol,
  };
}

/** Formats a number as localized currency (e.g. `$1,234.56`), falling back to a plain `CUR amount` string for unsupported currency codes. */
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
