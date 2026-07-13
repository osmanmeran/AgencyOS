import { refreshRates } from './exchangeRates.js';
import logger from '../lib/logger.js';

let intervalHandle = null;
let isRunning = false;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh the stored exchange-rate snapshot immediately, then repeat every 24
 * hours so the app always has a recent rateset without waiting for the first
 * live API call. The overlap guard prevents a slow refresh from stacking onto
 * the next tick.
 */
export function startExchangeRateScheduler() {
  logger.info('Exchange rate scheduler started');

  const check = async () => {
    if (isRunning) {
      logger.warn('Exchange rate scheduler tick skipped — previous refresh still in progress');
      return;
    }
    isRunning = true;
    try {
      await refreshRates();
    } catch (err) {
      logger.error({ err: err.message }, 'Exchange rate daily refresh failed');
    } finally {
      isRunning = false;
    }
  };

  check();
  intervalHandle = setInterval(check, DAY_MS);
  logger.info('Exchange rate scheduler scheduled (every 24 hours)');
}

/** Cancel the scheduled exchange-rate refresh interval, if running. */
export function stopExchangeRateScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Exchange rate scheduler stopped');
  }
}
