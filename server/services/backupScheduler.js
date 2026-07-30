import path from 'path';
import { getDb, getPlatformDb, getDataDir, getTenantsDir, getUploadDir, getPdfDir, DEFAULT_TENANT_ID } from '../db.js';
import { allTenantIds, getTenantById } from './tenants.js';
import logger from '../lib/logger.js';
import { createBackupAsync, pruneBackups } from './backup.js';
import { isOffsiteConfigured, pushSnapshot, syncDirectory, pruneSnapshots } from './offsiteBackup.js';
import { recordBackupRun, alertOnFailure } from './backupRuns.js';

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
    return { dest, offsiteError: err.message };
  }
  return { dest };
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
 * Run the full backup pass over every database, collecting a per-target result
 * so the outcome can be recorded and alerted on. Exported so the scheduler and
 * tests can trigger a single deterministic pass.
 * @returns {Promise<object>} The recorded run row.
 */
export async function runBackupPass() {
  const startedAt = new Date().toISOString();
  const results = [];

  /** Run one target, capturing failure instead of aborting the whole pass. */
  const attempt = async (scope, label, fn) => {
    try {
      const out = await fn();
      results.push({ scope, label, ok: !out?.offsiteError, ...(out?.offsiteError && { error: out.offsiteError }) });
    } catch (err) {
      results.push({ scope, label, ok: false, error: err.message });
      logger.error({ err: err.message, scope }, 'Backup target failed');
    }
  };

  // Legacy/default tenant — unchanged location, data/backups/.
  await attempt(`tenants/${DEFAULT_TENANT_ID}`, 'primary workspace', () =>
    backupOne({
      db: getDb(DEFAULT_TENANT_ID),
      dataDir: getDataDir(),
      label: 'daily',
      scope: `tenants/${DEFAULT_TENANT_ID}`,
    }),
  );
  await syncFilesFor(DEFAULT_TENANT_ID, `tenants/${DEFAULT_TENANT_ID}`);

  // Platform registry (tenants table) — small but load-bearing.
  await attempt('platform', 'platform registry', () =>
    backupOne({ db: getPlatformDb(), dataDir: getDataDir(), label: 'platform-daily', scope: 'platform' }),
  );

  // Every other workspace, each into its own backups/ directory.
  for (const tenantId of allTenantIds()) {
    if (tenantId === DEFAULT_TENANT_ID) continue;
    const scope = `tenants/${tenantId}`;
    const tenant = getTenantById(tenantId);
    await attempt(scope, tenant ? `${tenant.name} (${tenant.slug})` : scope, () =>
      backupOne({
        db: getDb(tenantId),
        dataDir: path.join(getTenantsDir(), String(tenantId)),
        label: 'daily',
        scope,
      }),
    );
    await syncFilesFor(tenantId, scope);
  }

  const run = recordBackupRun({ startedAt, results, offsite: isOffsiteConfigured() });
  logger.info({ total: run.total, failed: run.failed }, 'Backup pass complete');
  if (run.failed > 0) await alertOnFailure({ ...run, detail: results });
  return run;
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
 * volume doesn't take the backups with it. Every pass is recorded in the
 * platform DB and failures are emailed to the operator.
 */
export function startBackupScheduler() {
  logger.info({ offsite: isOffsiteConfigured() }, 'Backup scheduler started');

  const run = () => {
    runBackupPass().catch((err) => logger.error({ err: err.message }, 'Backup pass failed'));
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
