import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { DEFAULT_TENANT_ID, getDataDir, getTenantsDir } from '../db.js';
import { getTenantById } from '../services/tenants.js';

/**
 * Warn when tenant zero has a database on disk but no row in the platform
 * registry.
 *
 * This state is silent until someone tries to log in: `authenticateMicrosoft`
 * resolves the tenant, finds the user in a perfectly healthy database, then
 * throws "Workspace not found." on the `getTenantById` lookup a few lines
 * later. Production sat in it after the multi-tenant layer shipped without its
 * one-off registration step ever being run, and it recurs on any deployment
 * that starts with a fresh platform.db (a recreated volume, a new environment)
 * beside an existing business database.
 *
 * Reports rather than throws: the rest of the app works fine in this state, and
 * killing the process would take down the working parts to protest a
 * recoverable config gap. `scripts/register-tenant-zero.mjs` is the fix, and it
 * does not need the server running.
 *
 * @returns {{ok: true}|{ok: false, dbPath: string}|{ok: true, skipped: string}}
 */
export function checkTenantZeroRegistered() {
  try {
    // Mirrors tenantDbPath() in db.js: tenant zero lives at the adopted path
    // once adopt-tenant-zero has run, and at the legacy path until then.
    const adopted = path.join(getTenantsDir(), String(DEFAULT_TENANT_ID), 'marvelops.db');
    const legacy = path.join(getDataDir(), 'marvelops.db');
    const dbPath = fs.existsSync(adopted) ? adopted : fs.existsSync(legacy) ? legacy : null;

    // No database yet — a genuinely fresh install, nothing to warn about.
    if (!dbPath) return { ok: true, skipped: 'no tenant-zero database on disk' };

    if (getTenantById(DEFAULT_TENANT_ID)) return { ok: true };

    logger.error(
      { tenantId: DEFAULT_TENANT_ID, dbPath, fix: 'scripts/register-tenant-zero.mjs' },
      'Tenant zero has a database but no row in the platform registry — Microsoft SSO login ' +
        'will fail with "Workspace not found." until it is registered. Fix with: node ' +
        'scripts/register-tenant-zero.mjs --slug <slug> --name "<name>" --apply',
    );
    return { ok: false, dbPath };
  } catch (err) {
    // A broken check must never be the reason the server fails to boot.
    logger.warn({ err: err.message }, 'Tenant-zero registry check could not run');
    return { ok: true, skipped: 'check failed' };
  }
}
