import { getDb } from '../db.js';
import { forEachTenant } from './tenants.js';
import logger from '../lib/logger.js';

let intervalHandle = null;
let isRunning = false;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes revoked or expired rows from one tenant's `refresh_tokens` table.
 * Every access-token refresh inserts a new row and revokes the old one (see
 * services/auth.js's rotateRefreshToken), so without this the table grows
 * unbounded per tenant — the rows are harmless once revoked/expired (lookups
 * stay index-backed regardless of table size), but there's no reason to keep
 * them forever either.
 * @returns {number} Rows deleted.
 */
export function pruneRefreshTokens() {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare('DELETE FROM refresh_tokens WHERE revoked = 1 OR expires_at < ?').run(now);
  return result.changes;
}

/** Prunes every tenant's refresh_tokens table in one pass. @returns {number} Total rows deleted across all tenants. */
export async function pruneRefreshTokensAllTenants() {
  let total = 0;
  await forEachTenant(
    () => {
      total += pruneRefreshTokens();
    },
    { label: 'refresh token pruning' },
  );
  return total;
}

/**
 * Prunes revoked/expired refresh tokens across every workspace immediately,
 * then repeats every 24 hours alongside the other daily maintenance jobs.
 */
export function startRefreshTokenPruning() {
  logger.info('Refresh token pruning scheduler started');

  const run = async () => {
    if (isRunning) {
      logger.warn('Refresh token pruning tick skipped — previous run still in progress');
      return;
    }
    isRunning = true;
    try {
      const total = await pruneRefreshTokensAllTenants();
      logger.info({ deleted: total }, 'Refresh token pruning complete');
    } catch (err) {
      logger.error({ err: err.message }, 'Refresh token pruning failed');
    } finally {
      isRunning = false;
    }
  };

  run();
  intervalHandle = setInterval(run, DAY_MS);
  logger.info('Refresh token pruning scheduled (every 24 hours)');
}

/** Cancel the scheduled pruning interval, if running. */
export function stopRefreshTokenPruning() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Refresh token pruning stopped');
  }
}
