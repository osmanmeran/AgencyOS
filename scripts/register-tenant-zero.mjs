#!/usr/bin/env node
// Register the default workspace ("tenant zero") in the platform registry,
// fixing "Workspace not found." on Microsoft SSO login.
//
// Why this exists separately from adopt-tenant-zero.mjs: that script MOVES the
// business database to data/tenants/0/marvelops.db and then registers it. When
// the database is still at the legacy data/marvelops.db path, the move is not
// actually required — tenantDbPath() in server/db.js already falls back to the
// legacy path for tenant zero, so the app reads that data correctly today. The
// only thing missing is the registry row that getTenantById() looks up. This
// script writes just that row, leaving the business database untouched.
//
// It writes a single row to platform.db. It never opens, moves, or modifies the
// business database.
//
// DRY RUN by default. `--apply` performs the insert.
//
// Usage:
//   node scripts/register-tenant-zero.mjs --slug marveltour --name "Marvel Tour"
//   node scripts/register-tenant-zero.mjs --slug marveltour --name "Marvel Tour" --apply

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_TENANT_ID = '0';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'platform', 'auth', 'mail', 'ftp', 'status', 'cdn']);
// Mirrors AZURE_TENANT_RE in services/tenants.js — the column holds a GUID.
const AZURE_TENANT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv) {
  const args = { apply: false, slug: null, name: null, azureTenantId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--slug') args.slug = argv[++i];
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--azure-tenant-id') args.azureTenantId = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
  const platformDbPath = path.join(DATA_DIR, 'platform.db');

  if (!args.slug || !args.name) {
    throw new Error('Both --slug and --name are required, e.g. --slug marveltour --name "Marvel Tour"');
  }
  const slug = String(args.slug).toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
    throw new Error(`Slug "${args.slug}" is invalid or reserved.`);
  }

  // Falls back to the env var authenticateMicrosoft() would otherwise use, so
  // the stored row does not depend on that variable staying set.
  const azureTenantId = args.azureTenantId || process.env.MICROSOFT_TENANT_ID || null;
  if (azureTenantId && !AZURE_TENANT_RE.test(azureTenantId)) {
    throw new Error(
      `azure_tenant_id must be a GUID, got "${azureTenantId}". ` +
        'authenticateMicrosoft compares it against the token\'s "tid" claim, which is always a ' +
        'GUID — a domain name here would reject every login.',
    );
  }

  if (!fs.existsSync(platformDbPath)) {
    throw new Error(`Platform database not found at ${platformDbPath}. Start the app once to create it.`);
  }

  const platformDb = new Database(platformDbPath);
  const hasTable = platformDb
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tenants'")
    .get();
  if (!hasTable) {
    platformDb.close();
    throw new Error('platform.db has no "tenants" table. Run the platform migrations first.');
  }

  const existingById = platformDb.prepare('SELECT * FROM tenants WHERE id = ?').get(DEFAULT_TENANT_ID);
  const existingBySlug = platformDb.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);

  console.log('Tenant-zero registration plan');
  console.log('=============================');
  console.log(`  Platform DB     : ${platformDbPath}`);
  console.log(`  Tenant id       : ${DEFAULT_TENANT_ID}`);
  console.log(`  Tenant slug     : ${slug}`);
  console.log(`  Tenant name     : ${args.name}`);
  console.log(`  azure_tenant_id : ${azureTenantId || '(not set — will fall back to MICROSOFT_TENANT_ID at login)'}`);
  console.log(`  Mode            : ${args.apply ? 'APPLY (will write one row)' : 'DRY RUN (no changes)'}`);
  console.log('\n  The business database is NOT touched by this script.');

  const problems = [];
  if (existingById) problems.push(`Tenant zero (id '${DEFAULT_TENANT_ID}') is already registered.`);
  if (existingBySlug && existingBySlug.id !== DEFAULT_TENANT_ID) {
    problems.push(`Slug "${slug}" is already taken by tenant ${existingBySlug.id}.`);
  }

  if (problems.length) {
    console.log('\nCannot proceed:');
    for (const p of problems) console.log(`  - ${p}`);
    platformDb.close();
    process.exit(1);
  }

  if (!args.apply) {
    console.log('\nDRY RUN — no changes made. Re-run with --apply to write the row.');
    platformDb.close();
    process.exit(0);
  }

  platformDb
    .prepare(
      `INSERT INTO tenants (id, slug, name, status, azure_tenant_id, created_date)
       VALUES (?, ?, ?, 'active', ?, datetime('now'))`,
    )
    .run(DEFAULT_TENANT_ID, slug, args.name, azureTenantId);

  const row = platformDb.prepare('SELECT * FROM tenants WHERE id = ?').get(DEFAULT_TENANT_ID);
  console.log('\nDone. Registered:');
  console.log(`  ${JSON.stringify(row)}`);
  console.log('\nMicrosoft SSO login should now resolve this workspace. No restart is needed —');
  console.log('getTenantById() reads platform.db per request.');
  platformDb.close();
}

main();
