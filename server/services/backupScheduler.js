import path from 'path';
import { getDb, getPlatformDb, getDataDir, getTenantsDir, DEFAULT_TENANT_ID } from '../db.js';
import { allTenantIds } from './tenants.js';
import logger from '../lib/logger.js';
import { createBackupAsync, pruneBackups } from './backup.js';

let intervalHandle = null;

const KEEP_BACKUPS = 14;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Run an immediate backup of every database — the legacy/default tenant and the
 * platform registry into `data/backups/`, each other tenant into its own
 * `data/tenants/<id>/backups/` — then repeat every 24 hours, pruning each
 * rotation to {@link KEEP_BACKUPS}. Pruning is label-scoped so one-off safety
 * snapshots ('pre-migration', 'pre-saas') rotate independently of the dailies.
 */
export function startBackupScheduler() {
  logger.info('Backup scheduler started');

  const run = async () => {
    // Legacy/default tenant — unchanged location, data/backups/.
    try {
      const dest = await createBackupAsync(getDb(DEFAULT_TENANT_ID), getDataDir(), 'daily');
      const removed = pruneBackups(getDataDir(), KEEP_BACKUPS, 'daily');
      logger.info({ dest, removedCount: removed.length }, 'Daily DB backup created');
    } catch (err) {
      logger.error({ err: err.message }, 'Daily DB backup failed');
    }

    // Platform registry (tenants table) — small but load-bearing.
    try {
      const dest = await createBackupAsync(getPlatformDb(), getDataDir(), 'platform-daily');
      pruneBackups(getDataDir(), KEEP_BACKUPS, 'platform-daily');
      logger.info({ dest }, 'Daily platform DB backup created');
    } catch (err) {
      logger.error({ err: err.message }, 'Daily platform DB backup failed');
    }

    // Every other workspace, each into its own backups/ directory.
    for (const tenantId of allTenantIds()) {
      if (tenantId === DEFAULT_TENANT_ID) continue;
      const tenantDataDir = path.join(getTenantsDir(), String(tenantId));
      try {
        const dest = await createBackupAsync(getDb(tenantId), tenantDataDir, 'daily');
        pruneBackups(tenantDataDir, KEEP_BACKUPS, 'daily');
        logger.info({ dest, tenantId }, 'Daily tenant DB backup created');
      } catch (err) {
        logger.error({ err: err.message, tenantId }, 'Daily tenant DB backup failed');
      }
    }
  };

  run();
  intervalHandle = setInterval(run, INTERVAL_MS);
  logger.info('Backup scheduler scheduled (every 24 hours)');
}

/** Cancel the scheduled backup interval, if running. */
export function stopBackupScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Backup scheduler stopped');
  }
}
