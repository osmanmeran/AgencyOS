import { getDb } from '../db.js';
import logger from '../lib/logger.js';
import { forEachTenant } from './tenants.js';

let intervalHandle = null;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Delete revoked/expired rows from one tenant's refresh_tokens table. Rows are
 * useless once revoked or past expires_at (lookups already exclude them), but
 * every access-token refresh inserts a new row and nothing ever deleted the
 * old ones, so the table grew unbounded.
 * @returns {number} rows deleted
 */
export function pruneRefreshTokens(db) {
  const result = db
    .prepare('DELETE FROM refresh_tokens WHERE revoked = 1 OR expires_at < ?')
    .run(new Date().toISOString());
  return result.changes;
}

/** Prune expired/revoked refresh tokens across every tenant's database. */
export async function pruneRefreshTokensAllTenants() {
  let total = 0;
  await forEachTenant(
    () => {
      total += pruneRefreshTokens(getDb());
    },
    { label: 'refresh token cleanup' },
  );
  return total;
}

/** Prune expired/revoked refresh tokens immediately, then repeat every 24 hours. */
export function startRefreshTokenCleanupScheduler() {
  logger.info('Refresh token cleanup scheduler started');

  const run = () => {
    pruneRefreshTokensAllTenants()
      .then((count) => {
        if (count > 0) logger.info({ count }, 'Pruned expired/revoked refresh tokens');
      })
      .catch((err) => logger.error({ err: err.message }, 'Refresh token cleanup failed'));
  };

  run();
  intervalHandle = setInterval(run, DAY_MS);
  logger.info('Refresh token cleanup scheduled (every 24 hours)');
}

/** Cancel the scheduled refresh-token cleanup interval, if running. */
export function stopRefreshTokenCleanupScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Refresh token cleanup scheduler stopped');
  }
}
