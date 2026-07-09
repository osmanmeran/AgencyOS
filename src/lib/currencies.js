// Single source of truth for currency display symbols across the app.
// Intl renders some currencies as codes (e.g. MAD, EGP) or with no symbol,
// so we keep a curated override map; everything else falls back to Intl and
// finally to the raw currency code so nothing ever silently shows the wrong
// symbol (e.g. defaulting to $/USD).

const CURATED_SYMBOLS = {
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
  if (CURATED_SYMBOLS[cur]) return CURATED_SYMBOLS[cur];
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

export const CURRENCY_SYMBOLS = CURATED_SYMBOLS;
