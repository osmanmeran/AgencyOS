import path from 'path';
import { getDb, getPlatformDb, getDataDir, getTenantsDir, getUploadDir, getPdfDir, DEFAULT_TENANT_ID } from '../db.js';
import { allTenantIds } from './tenants.js';
import logger from '../lib/logger.js';
import { createBackupAsync, pruneBackups } from './backup.js';
import { isOffsiteConfigured, pushSnapshot, syncDirectory, pruneSnapshots } from './offsiteBackup.js';

let intervalHandle = null;

const KEEP_BACKUPS = 14;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Back one database up locally, then push the snapshot off-box if configured.
 * Off-box failure is logged but never fails the local backup — a working local
 * snapshot is more important than the copy of it.
 */
async function backupOne({ db, dataDir, label, scope }) {
  const dest = await createBackupAsync(db, dataDir, label);
  pruneBackups(dataDir, KEEP_BACKUPS, label);
  try {
    await pushSnapshot(dest, scope);
    await pruneSnapshots(scope);
  } catch (err) {
    logger.error({ err: err.message, scope }, 'Off-box snapshot upload failed');
  }
  return dest;
}

/** Mirror a workspace's uploaded files and generated PDFs off-box. */
async function syncFilesFor(tenantId, scope) {
  if (!isOffsiteConfigured()) return;
  try {
    const uploads = await syncDirectory(getUploadDir(tenantId), `${scope}/uploads`);
    const pdfs = await syncDirectory(getPdfDir(tenantId), `${scope}/pdfs`);
    logger.info({ scope, uploads, pdfs }, 'Off-box file sync complete');
  } catch (err) {
    logger.error({ err: err.message, scope }, 'Off-box file sync failed');
  }
}

/**
 * Run an immediate backup of every database — the legacy/default tenant and the
 * platform registry into `data/backups/`, each other tenant into its own
 * `data/tenants/<id>/backups/` — then repeat every 24 hours, pruning each
 * rotation to {@link KEEP_BACKUPS}. Pruning is label-scoped so one-off safety
 * snapshots ('pre-migration', 'pre-saas') rotate independently of the dailies.
 *
 * When BACKUP_S3_* is configured, each snapshot is also pushed to object
 * storage along with the uploaded files the database references, so a lost
 * volume doesn't take the backups with it.
 */
export function startBackupScheduler() {
  logger.info({ offsite: isOffsiteConfigured() }, 'Backup scheduler started');

  const run = async () => {
    // Legacy/default tenant — unchanged location, data/backups/.
    try {
      const dest = await backupOne({
        db: getDb(DEFAULT_TENANT_ID),
        dataDir: getDataDir(),
        label: 'daily',
        scope: `tenants/${DEFAULT_TENANT_ID}`,
      });
      logger.info({ dest }, 'Daily DB backup created');
    } catch (err) {
      logger.error({ err: err.message }, 'Daily DB backup failed');
    }
    await syncFilesFor(DEFAULT_TENANT_ID, `tenants/${DEFAULT_TENANT_ID}`);

    // Platform registry (tenants table) — small but load-bearing.
    try {
      const dest = await backupOne({
        db: getPlatformDb(),
        dataDir: getDataDir(),
        label: 'platform-daily',
        scope: 'platform',
      });
      logger.info({ dest }, 'Daily platform DB backup created');
    } catch (err) {
      logger.error({ err: err.message }, 'Daily platform DB backup failed');
    }

    // Every other workspace, each into its own backups/ directory.
    for (const tenantId of allTenantIds()) {
      if (tenantId === DEFAULT_TENANT_ID) continue;
      const tenantDataDir = path.join(getTenantsDir(), String(tenantId));
      const scope = `tenants/${tenantId}`;
      try {
        const dest = await backupOne({
          db: getDb(tenantId),
          dataDir: tenantDataDir,
          label: 'daily',
          scope,
        });
        logger.info({ dest, tenantId }, 'Daily tenant DB backup created');
      } catch (err) {
        logger.error({ err: err.message, tenantId }, 'Daily tenant DB backup failed');
      }
      await syncFilesFor(tenantId, scope);
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
