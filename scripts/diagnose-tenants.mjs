#!/usr/bin/env node
// READ-ONLY diagnostic for "Workspace not found." on Microsoft SSO login.
//
// That error (services/auth.js) means SSO resolved a tenant id, but no matching
// row exists in the platform registry (platform.db -> tenants). The per-tenant
// business database can be perfectly healthy while the registry row is missing,
// which is exactly the state this script is meant to reveal.
//
// It opens every database read-only, runs no migrations, and writes nothing —
// safe to run against production. It deliberately does NOT import server/db.js,
// because that module runs migrations at import time.
//
// Usage:
//   node scripts/diagnose-tenants.mjs
//   node scripts/diagnose-tenants.mjs --email you@example.com

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_TENANT_ID = '0';

function parseArgs(argv) {
  const args = { email: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--email') args.email = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

/** Open read-only, returning null instead of throwing when absent/unreadable. */
function openReadOnly(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return new Database(file, { readonly: true, fileMustExist: true });
  } catch (err) {
    console.log(`  ! Could not open ${file}: ${err.message}`);
    return null;
  }
}

function describeUsers(db, email) {
  try {
    const total = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const sso = db.prepare('SELECT COUNT(*) AS n FROM users WHERE microsoft_id IS NOT NULL').get().n;
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE user_tier = 'admin'").get().n;
    let line = `${total} users (${admins} admin, ${sso} SSO-linked)`;
    if (email) {
      const u = db
        .prepare('SELECT id, user_tier, is_active, microsoft_id FROM users WHERE LOWER(email) = ?')
        .get(email.trim().toLowerCase());
      line += u
        ? `\n      -> ${email}: found, tier=${u.user_tier}, active=${!!u.is_active}, sso_linked=${!!u.microsoft_id}`
        : `\n      -> ${email}: NOT in this database`;
    }
    return line;
  } catch (err) {
    return `could not read users table (${err.message})`;
  }
}

function main() {
  const args = parseArgs(process.argv);
  const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
  const platformPath = path.join(DATA_DIR, 'platform.db');
  const legacyPath = path.join(DATA_DIR, 'marvelops.db');
  const tenantsDir = path.join(DATA_DIR, 'tenants');

  console.log('Tenant registry diagnostic (read-only)');
  console.log('======================================');
  console.log(`  DATA_DIR    : ${DATA_DIR} ${fs.existsSync(DATA_DIR) ? '' : '(MISSING)'}`);
  console.log(`  platform.db : ${platformPath} ${fs.existsSync(platformPath) ? '(exists)' : '(MISSING)'}`);
  console.log(`  legacy db   : ${legacyPath} ${fs.existsSync(legacyPath) ? '(exists)' : '(not present)'}`);

  // 1. The registry — the thing "Workspace not found." is actually complaining about.
  console.log('\n1. Registered tenants (platform.db -> tenants)');
  let registered = [];
  const platformDb = openReadOnly(platformPath);
  if (!platformDb) {
    console.log('   platform.db is missing or unreadable — nothing is registered.');
  } else {
    try {
      registered = platformDb.prepare('SELECT id, slug, name, status, azure_tenant_id FROM tenants').all();
      if (registered.length === 0) console.log('   (table is EMPTY — no workspace is registered)');
      for (const t of registered) {
        console.log(`   - id=${t.id} slug=${t.slug} name=${t.name} status=${t.status}`);
        console.log(`     azure_tenant_id: ${t.azure_tenant_id || '(not set)'}`);
      }
    } catch (err) {
      console.log(`   Could not read the tenants table: ${err.message}`);
    }
    platformDb.close();
  }

  // 2. Databases actually on disk, which may exist with no registry row.
  console.log('\n2. Tenant databases on disk');
  const onDisk = [];
  if (fs.existsSync(tenantsDir)) {
    for (const entry of fs.readdirSync(tenantsDir).sort()) {
      const file = path.join(tenantsDir, entry, 'marvelops.db');
      if (fs.existsSync(file)) onDisk.push({ id: entry, label: entry, file });
    }
  }
  // The legacy file IS tenant zero's database: tenantDbPath() in server/db.js
  // falls back to it when the adopted path is absent. It must therefore match
  // registry id "0", or a correctly-registered deployment reads as an orphan.
  const adoptedZero = onDisk.some((d) => d.id === DEFAULT_TENANT_ID);
  if (fs.existsSync(legacyPath) && !adoptedZero) {
    onDisk.push({ id: DEFAULT_TENANT_ID, label: `${DEFAULT_TENANT_ID} (legacy path, not adopted)`, file: legacyPath });
  }

  if (onDisk.length === 0) {
    console.log('   None found.');
  } else {
    for (const { label, file } of onDisk) {
      const sizeMb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
      console.log(`   - tenant id ${label} (${sizeMb} MB)`);
      console.log(`     ${file}`);
      const db = openReadOnly(file);
      if (db) {
        console.log(`     ${describeUsers(db, args.email)}`);
        db.close();
      }
    }
  }

  // 3. The mismatch that produces the error.
  console.log('\n3. Diagnosis');
  const registeredIds = new Set(registered.map((t) => String(t.id)));
  const orphans = onDisk.filter((d) => !registeredIds.has(String(d.id)));
  const zeroOnDisk = onDisk.some((d) => String(d.id) === DEFAULT_TENANT_ID);

  if (orphans.length === 0 && registered.length > 0) {
    console.log('   Every database on disk has a registry row. "Workspace not found." is');
    console.log('   NOT explained by a missing row — capture the server logs around the');
    console.log('   failed login and investigate from there.');
  } else {
    for (const o of orphans) {
      console.log(`   ORPHAN: a database exists for tenant "${o.label}" with no row in platform.db.`);
    }
    if (zeroOnDisk && !registeredIds.has(DEFAULT_TENANT_ID)) {
      console.log('');
      console.log('   This is the cause. SSO login resolves to the default tenant id "0" and');
      console.log('   finds your user there, but getTenantById("0") returns nothing, so');
      console.log('   authenticateMicrosoft throws "Workspace not found." before issuing a');
      console.log('   session. The business data is intact — only the registry row is absent.');
      console.log('');
      console.log('   Fix by writing that row (dry run first — it changes nothing):');
      console.log('     node scripts/register-tenant-zero.mjs --slug marveltour --name "Marvel Tour"');
      console.log('');
      console.log('   Moving the database is NOT required: tenantDbPath() already falls back to');
      console.log('   the legacy path for tenant zero. adopt-tenant-zero.mjs would also work, but');
      console.log('   it relocates a live database to do a job one INSERT can do.');
    }
  }

  console.log('\nNo changes were made — this script only reads.');
}

main();
