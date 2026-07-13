import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { getDb } from '../../server/db.js';

const { refreshRates, getStoredRates, getExchangeRate } = await import('../../server/services/exchangeRates.js');

const db = getDb();

// USD-based rate table mimicking the currency-api shape.
const SAMPLE_RATES = {
  usd: 1,
  eur: 0.92,
  gbp: 0.79,
  try: 32.5,
};

function stubRates() {
  return vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ usd: SAMPLE_RATES }),
    })),
  );
}

describe('Exchange Rates Service', () => {
  beforeAll(() => {
    getDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    db.prepare('DELETE FROM exchange_rates').run();
  });

  it('refreshRates fetches from the provider and persists a snapshot', async () => {
    stubRates();
    const result = await refreshRates();
    expect(result.rates.eur).toBe(0.92);
    expect(result.source).toContain('currency-api');
    expect(result.updated_at).toBeTruthy();

    const stored = getStoredRates();
    expect(stored.rates.eur).toBe(0.92);
    expect(stored.source).toBe(result.source);
  });

  it('getExchangeRate uses the stored snapshot without re-fetching', async () => {
    stubRates();
    await refreshRates();

    // Now force fetch to throw — getExchangeRate must still resolve from storage.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const res = await getExchangeRate('USD', 'EUR');
    expect(res.rate).toBeCloseTo(0.92, 5);
    expect(res.stored).toBe(true);
  });

  it('getExchangeRate converts across two non-USD currencies via the USD base', async () => {
    stubRates();
    await refreshRates();
    const res = await getExchangeRate('GBP', 'TRY');
    // 32.5 / 0.79
    expect(res.rate).toBeCloseTo(32.5 / 0.79, 4);
  });

  it('throws BadRequestError for an unsupported currency', async () => {
    stubRates();
    await refreshRates();
    await expect(getExchangeRate('USD', 'ZZZ')).rejects.toThrow();
  });
});
