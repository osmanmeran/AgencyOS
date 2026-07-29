import crypto from 'crypto';
import { getPlatformDb, DEFAULT_TENANT_ID, runWithTenant } from '../db.js';
import { sendEmail, isSmtpConfigured } from './email.js';
import { isPlatformAdmin } from './platform.js';
import logger from '../lib/logger.js';

// How long without a successful run before the last backup counts as stale.
// Slightly over a day so a single late run doesn't cry wolf.
const STALE_AFTER_MS = 30 * 60 * 60 * 1000;

/**
 * Persist the outcome of one backup run.
 * @param {{startedAt: string, results: Array<{scope: string, label?: string, ok: boolean, error?: string}>, offsite: boolean}} run
 * @returns {object} The stored row.
 */
export function recordBackupRun({ startedAt, results, offsite }) {
  const db = getPlatformDb();
  const failed = results.filter((r) => !r.ok);
  const row = {
    id: crypto.randomBytes(8).toString('hex'),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    ok: failed.length === 0 ? 1 : 0,
    total: results.length,
    failed: failed.length,
    offsite: offsite ? 1 : 0,
    detail: JSON.stringify(results),
  };
  db.prepare(
    `INSERT INTO backup_runs (id, started_at, finished_at, ok, total, failed, offsite, detail)
     VALUES (@id, @started_at, @finished_at, @ok, @total, @failed, @offsite, @detail)`,
  ).run(row);
  return row;
}

/** @returns {object|null} The most recent run, with `detail` parsed. */
export function lastBackupRun() {
  const row = getPlatformDb().prepare('SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 1').get();
  if (!row) return null;
  let detail = [];
  try {
    detail = JSON.parse(row.detail || '[]');
  } catch {
    /* keep the row usable even if detail is unreadable */
  }
  return { ...row, ok: !!row.ok, offsite: !!row.offsite, detail };
}

/** @returns {object|null} The most recent fully-successful run. */
export function lastSuccessfulBackupRun() {
  const row = getPlatformDb().prepare('SELECT * FROM backup_runs WHERE ok = 1 ORDER BY started_at DESC LIMIT 1').get();
  return row ? { ...row, ok: true, offsite: !!row.offsite } : null;
}

/**
 * Backup health for the platform dashboard: when the last run happened, whether
 * it succeeded, and whether a successful run has gone missing entirely (which
 * is the failure a per-run alert can never catch — a scheduler that died sends
 * nothing at all).
 * @returns {{lastRunAt: string|null, lastSuccessAt: string|null, ok: boolean, stale: boolean, failed: number, total: number, offsite: boolean, failures: Array<{scope: string, label?: string, error?: string}>}}
 */
export function backupHealth() {
  const last = lastBackupRun();
  const lastSuccess = lastSuccessfulBackupRun();
  const lastSuccessAt = lastSuccess?.started_at || null;
  return {
    lastRunAt: last?.started_at || null,
    lastSuccessAt,
    ok: last ? last.ok : false,
    // No run at all is stale too — that's the "nothing is running" case.
    stale: !lastSuccessAt || Date.now() - Date.parse(lastSuccessAt) > STALE_AFTER_MS,
    failed: last?.failed || 0,
    total: last?.total || 0,
    offsite: last?.offsite || false,
    failures: (last?.detail || []).filter((d) => !d.ok).map(({ scope, label, error }) => ({ scope, label, error })),
  };
}

/** Who receives backup alerts: BACKUP_ALERT_EMAIL, else the platform admins. */
export function alertRecipients() {
  const explicit = (process.env.BACKUP_ALERT_EMAIL || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Email the operator when a run had failures. Best-effort and never throws —
 * an alerting problem must not take down the backup job it is reporting on.
 * @returns {Promise<boolean>} Whether an alert was sent.
 */
export async function alertOnFailure(run) {
  const failures = run.detail ? run.detail : JSON.parse(run.detail || '[]');
  const failed = (Array.isArray(failures) ? failures : []).filter((r) => !r.ok);
  if (failed.length === 0) return false;

  const to = alertRecipients();
  if (to.length === 0) {
    logger.error(
      { failed: failed.length },
      'Backup run had failures but no alert recipient is configured (set BACKUP_ALERT_EMAIL or PLATFORM_ADMIN_EMAILS)',
    );
    return false;
  }
  if (!isSmtpConfigured()) {
    logger.error({ failed: failed.length, to }, 'Backup run had failures but SMTP is not configured — cannot alert');
    return false;
  }

  const rows = failed
    .map((f) => `<li><strong>${f.label || f.scope}</strong>: ${f.error || 'unknown error'}</li>`)
    .join('');
  const body = `
    <h2 style="margin-top:0;">Backup failures</h2>
    <p>${failed.length} of ${run.total} backup target(s) failed on the run started ${run.started_at}.</p>
    <ul>${rows}</ul>
    <p>Check the server logs, then re-run <code>npm run backup:offsite push</code> once the cause is fixed.</p>`;

  try {
    // sendEmail logs to the tenant database; pin it to the primary workspace so
    // the alert is recorded somewhere predictable regardless of the caller.
    await runWithTenant(DEFAULT_TENANT_ID, () =>
      sendEmail({ to, subject: `[Marvelops] ${failed.length} backup failure(s)`, body }),
    );
    logger.info({ to, failed: failed.length }, 'Backup failure alert sent');
    return true;
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to send backup failure alert');
    return false;
  }
}

/** @returns {boolean} Whether `email` may read backup health (platform operators only). */
export function canReadBackupHealth(email) {
  return isPlatformAdmin(email);
}
