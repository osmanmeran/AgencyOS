import { getDb } from '../db.js';
import { BadRequestError } from '../middleware/errors.js';
import logger from '../lib/logger.js';
import { forEachTenant } from './tenants.js';

const RATES_API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
const RATES_TIMEOUT_MS = 5000;
// How long a stored snapshot is considered fresh before getExchangeRate falls
// back to a live API call. Slightly longer than the daily scheduler interval
// so a single missed daily refresh doesn't trigger per-request API hits.
const STORE_FRESHNESS_MS = 25 * 60 * 60 * 1000;

/**
 * Fetch the full USD-based rate table from the public currency API.
 * @returns {Promise<{rates: object, source: string, fetchedAt: string}>}
 */
export async function fetchRatesFromApi() {
  const res = await fetch(RATES_API_URL, { signal: AbortSignal.timeout(RATES_TIMEOUT_MS) });
  if (!res.ok) {
    throw new BadRequestError(`Currency rate provider returned ${res.status}`);
  }
  const data = await res.json();
  return {
    rates: data.usd,
    source: 'fawazahmed0/currency-api',
    fetchedAt: new Date().toISOString(),
  };
}

/** @returns {Promise<{rates: object, source: string, updated_at: string}|null>} */
export function getStoredRates() {
  const db = getDb();
  const row = db.prepare('SELECT rates, source, updated_at FROM exchange_rates WHERE id = 1').get();
  if (!row) return null;
  try {
    return { rates: JSON.parse(row.rates), source: row.source, updated_at: row.updated_at };
  } catch {
    return null;
  }
}

/**
 * Persist a rates snapshot as the single row (id = 1).
 * @param {{rates: object, source: string, fetchedAt: string}} snapshot
 */
export function storeRates({ rates, source, fetchedAt }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO exchange_rates (id, rates, source, updated_at) VALUES (1, @rates, @source, @updated_at)
     ON CONFLICT(id) DO UPDATE SET rates = @rates, source = @source, updated_at = @updated_at`,
  ).run({
    rates: JSON.stringify(rates),
    source,
    updated_at: fetchedAt,
  });
}

/**
 * Fetch fresh rates from the API and persist them. Throws if the API call
 * fails so callers (the scheduler) can log and keep the previous good snapshot.
 * @returns {Promise<{rates: object, source: string, updated_at: string}>}
 */
export async function refreshRates() {
  const snapshot = await fetchRatesFromApi();
  storeRates(snapshot);
  logger.info({ source: snapshot.source, updated_at: snapshot.fetchedAt }, 'Exchange rates refreshed');
  return { rates: snapshot.rates, source: snapshot.source, updated_at: snapshot.fetchedAt };
}

/**
 * Daily-scheduler variant of {@link refreshRates}: one API fetch, then the
 * snapshot is persisted into every workspace's database (rates are global, but
 * each tenant DB carries its own `exchange_rates` snapshot).
 * @returns {Promise<{rates: object, source: string, updated_at: string}>}
 */
export async function refreshRatesAllTenants() {
  const snapshot = await fetchRatesFromApi();
  await forEachTenant(() => storeRates(snapshot), { label: 'exchange rates' });
  logger.info({ source: snapshot.source, updated_at: snapshot.fetchedAt }, 'Exchange rates refreshed (all tenants)');
  return { rates: snapshot.rates, source: snapshot.source, updated_at: snapshot.fetchedAt };
}

/**
 * Look up the conversion rate between two currencies. Prefers the daily
 * snapshot stored in the database; falls back to a live API call when the
 * snapshot is stale or missing.
 * @returns {Promise<{rate: number, source: string, timestamp: string, stored: boolean}>}
 * @throws {BadRequestError} If either currency code is unsupported.
 */
export async function getExchangeRate(from, to) {
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();

  const stored = getStoredRates();
  const storedFresh = stored && Date.now() - new Date(stored.updated_at).getTime() < STORE_FRESHNESS_MS;

  let rates;
  let source;
  let timestamp;
  let usedStore = false;

  if (storedFresh) {
    rates = stored.rates;
    source = stored.source;
    timestamp = stored.updated_at;
    usedStore = true;
  } else {
    const fresh = await fetchRatesFromApi();
    rates = fresh.rates;
    source = fresh.source;
    timestamp = fresh.fetchedAt;
    // Persist opportunistically so a later request can reuse it.
    try {
      storeRates(fresh);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to persist fallback exchange rates');
    }
  }

  const fromRate = rates[fromLower];
  const toRate = rates[toLower];
  if (!fromRate || !toRate) {
    throw new BadRequestError(`Unsupported currency: ${!fromRate ? from : to}`);
  }
  return {
    rate: toRate / fromRate,
    source,
    timestamp,
    stored: usedStore,
  };
}
