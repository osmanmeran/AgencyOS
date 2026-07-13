import { useQuery } from '@tanstack/react-query';
import { db } from './DbContext';

/** Default currency set used everywhere until an admin overrides it in AppSettings. */
export const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'EGP', 'MAD', 'JPY', 'CHF', 'CAD', 'AUD'];

export const CURRENCY_NAMES = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  TRY: 'Turkish Lira',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  EGP: 'Egyptian Pound',
  MAD: 'Moroccan Dirham',
  JPY: 'Japanese Yen',
  CHF: 'Swiss Franc',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
};

/** Human-readable name for a currency code, falling back to the code itself. */
export function getCurrencyName(code) {
  return CURRENCY_NAMES[code] || code;
}

/**
 * The list of currencies offered in currency dropdowns. Comes from the admin-
 * configured `supported_currencies` in AppSettings, falling back to
 * {@link DEFAULT_CURRENCIES} when unset or empty. Shares the `appSettings`
 * react-query cache across all consumers.
 * @returns {string[]}
 */
export function useSupportedCurrencies() {
  const { data: settings } = useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    },
    staleTime: 60000,
  });
  const list = settings?.supported_currencies;
  if (Array.isArray(list) && list.length > 0) return list;
  return DEFAULT_CURRENCIES;
}
