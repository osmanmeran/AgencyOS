#!/usr/bin/env node
// Adopt the existing single-tenant production database (data/marvelops.db) as
// tenant zero of the multi-tenant SaaS layout. See SAAS_PROJECT.md, Phase 1.
//
// This is the "critical one-off" step and is intentionally conservative:
//   - DRY RUN by default: prints exactly what it would do, changes nothing.
//   - `--apply` performs the move + tenant registry insert, but still refuses
//     to run if tenant zero is already registered (idempotent / safe to re-run
//     in dry mode as many times as you like).
//
// What it does on --apply:
//   1. Ensures the platform DB (platform.db) and its `tenants` table exist
//      (runs the platform migrations).
//   2. Moves data/marvelops.db (+ its -wal/-shm siblings) to
//      data/tenants/0/marvelops.db.
//   3. Inserts a `tenants` row: id '0', the given slug/name, status 'active'.
//
// After adoption, server/db.js's getDb('0') resolves to the adopted path, so
// the app serves Marvel Tour's existing data as tenant zero with no further
// code changes. The original file is MOVED, not copied — nothing is wiped, but
// the move is permanent, so take an off-box backup first.
//
// Usage:
//   node scripts/adopt-tenant-zero.mjs --slug marveltour --name "Marvel Tour"
//   node scripts/adopt-tenant-zero.mjs --slug marveltour --name "Marvel Tour" --apply

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { migratePlatform } from '../server/migrations/runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = { apply: false, slug: null, name: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--slug') args.slug = argv[++i];
    else if (a === '--name') args.name = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'platform', 'auth', 'mail', 'ftp', 'status', 'cdn']);

function main() {
  const args = parseArgs(process.argv);
  const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
  const DEFAULT_TENANT_ID = '0';
  const source = path.join(DATA_DIR, 'marvelops.db');
  const adoptedDir = path.join(DATA_DIR, 'tenants', DEFAULT_TENANT_ID);
  const adopted = path.join(adoptedDir, 'marvelops.db');
  const platformDbPath = path.join(DATA_DIR, 'platform.db');

  if (!args.slug || !args.name) {
    throw new Error('Both --slug and --name are required, e.g. --slug marveltour --name "Marvel Tour"');
  }
  const slug = String(args.slug).toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
    throw new Error(`Slug "${args.slug}" is invalid or reserved.`);
  }

  // Open the platform DB (creates it) and make sure the tenants table exists.
  // We NEVER open the source marvelops.db here, so it's free to be renamed.
  const platformDb = new Database(platformDbPath);
  platformDb.pragma('journal_mode = WAL');
  migratePlatform(platformDb, { quiet: true });

  const existingById = platformDb.prepare('SELECT id FROM tenants WHERE id = ?').get(DEFAULT_TENANT_ID);
  const existingBySlug = platformDb.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);

  const problems = [];
  if (!fs.existsSync(source)) problems.push(`Source database not found: ${source}`);
  if (fs.existsSync(adopted)) problems.push(`Adopted path already exists: ${adopted}`);
  if (existingById) problems.push(`Tenant zero (id '0') is already registered.`);
  if (existingBySlug) problems.push(`Slug "${slug}" is already taken by another tenant.`);

  console.log('Tenant-zero adoption plan');
  console.log('=========================');
  console.log(`  DATA_DIR        : ${DATA_DIR}`);
  console.log(`  Source DB       : ${source} ${fs.existsSync(source) ? '(exists)' : '(MISSING)'}`);
  console.log(`  Adopted DB      : ${adopted} ${fs.existsSync(adopted) ? '(ALREADY EXISTS)' : '(will be created)'}`);
  console.log(`  Platform DB     : ${platformDbPath}`);
  console.log(`  Tenant id       : ${DEFAULT_TENANT_ID}`);
  console.log(`  Tenant slug     : ${slug}`);
  console.log(`  Tenant name     : ${args.name}`);
  console.log(`  Mode            : ${args.apply ? 'APPLY (will modify disk)' : 'DRY RUN (no changes)'}`);

  if (problems.length) {
    console.log('\nCannot proceed:');
    for (const p of problems) console.log(`  - ${p}`);
    platformDb.close();
    process.exit(1);
  }

  if (!args.apply) {
    console.log('\nDRY RUN — no changes made. Re-run with --apply to perform the adoption.');
    platformDb.close();
    process.exit(0);
  }

  // --- APPLY ---
  console.log('\nApplying...');
  fs.mkdirSync(adoptedDir, { recursive: true });
  // Move the main file and any WAL/SHM siblings so no writes are stranded.
  for (const suffix of ['', '-wal', '-shm']) {
    const from = source + suffix;
    if (fs.existsSync(from)) fs.renameSync(from, adopted + suffix);
  }
  platformDb
    .prepare(
      `INSERT INTO tenants (id, slug, name, status, azure_tenant_id, created_date)
       VALUES (?, ?, ?, 'active', NULL, datetime('now'))`
    )
    .run(DEFAULT_TENANT_ID, slug, args.name);
  platformDb.close();
  console.log(`Done. Tenant zero adopted at ${adopted}. The app now serves it via getDb('0').`);
  console.log('Take an off-box backup of the whole data/ directory if you have not already.');
  process.exit(0);
}

main();
