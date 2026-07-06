import { getDb, getDataDir } from '../db.js';
import logger from '../lib/logger.js';
import { createBackupAsync, pruneBackups } from './backup.js';

let intervalHandle = null;

const KEEP_BACKUPS = 14;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Run an immediate DB backup, then schedule one every 24 hours, pruning to {@link KEEP_BACKUPS}. */
export function startBackupScheduler() {
  logger.info('Backup scheduler started');

  const run = async () => {
    try {
      const dest = await createBackupAsync(getDb(), getDataDir(), 'daily');
      const removed = pruneBackups(getDataDir(), KEEP_BACKUPS);
      logger.info({ dest, removedCount: removed.length }, 'Daily DB backup created');
    } catch (err) {
      logger.error({ err: err.message }, 'Daily DB backup failed');
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
