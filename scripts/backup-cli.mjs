// Lists and restores SQLite backups (see server/services/backup.js and
// server/services/backupScheduler.js for how they're created).
//
// Run this from inside the production environment (where the data volume is
// mounted), e.g.:
//   railway ssh
//   node scripts/backup-cli.mjs list
//   node scripts/backup-cli.mjs restore marvelops-daily-2026-07-01T00-00-00-000Z.db
//
// Multi-tenant: every command defaults to the primary/legacy workspace, so the
// original single-tenant usage above is unchanged. Target another workspace by
// slug or id, and pull the snapshot from off-box storage when the local disk is
// gone (which is the case that off-box backups exist for):
//   node scripts/backup-cli.mjs list --tenant acme --offsite
//   node scripts/backup-cli.mjs restore marvelops-daily-….db --tenant acme --from-offsite
//
// IMPORTANT: stop the server before restoring. This script only touches files
// on disk — if the server is still running with the database open, overwriting
// it here will not take effect until restart and may leave the running process
// and the file on disk out of sync.

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DEFAULT_TENANT_ID = '0';

// --- argument parsing -------------------------------------------------------

const argv = process.argv.slice(2);
const command = argv[0];
const positional = argv.slice(1).filter((a) => !a.startsWith('--'));

function flag(name) {
  return argv.includes(`--${name}`);
}

function option(name) {
  const withEquals = argv.find((a) => a.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const idx = argv.indexOf(`--${name}`);
  return idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith('--') ? argv[idx + 1] : null;
}

// --- workspace resolution ---------------------------------------------------

/**
 * Resolve --tenant (a slug or an id) to the workspace's id, database path and
 * local backup directory. Mirrors server/db.js: the legacy workspace keeps the
 * top-level paths, every other workspace lives under data/tenants/<id>/.
 */
async function resolveTarget() {
  const requested = option('tenant');
  if (!requested || requested === DEFAULT_TENANT_ID) {
    const adopted = path.join(DATA_DIR, 'tenants', DEFAULT_TENANT_ID, 'marvelops.db');
    return {
      id: DEFAULT_TENANT_ID,
      label: 'primary workspace',
      dbPath: fs.existsSync(adopted) ? adopted : path.join(DATA_DIR, 'marvelops.db'),
      backupDir: path.join(DATA_DIR, 'backups'),
    };
  }

  // Imported lazily so the default (single-tenant) path never opens platform.db.
  const { getTenantBySlug, getTenantById } = await import('../server/services/tenants.js');
  const tenant = getTenantBySlug(requested) || getTenantById(requested);
  if (!tenant) {
    throw new Error(`No workspace found for "${requested}" (tried slug then id).`);
  }
  return {
    id: tenant.id,
    label: `${tenant.name} (${tenant.slug})`,
    dbPath: path.join(DATA_DIR, 'tenants', tenant.id, 'marvelops.db'),
    backupDir: path.join(DATA_DIR, 'tenants', tenant.id, 'backups'),
  };
}

/** Off-box scope key for a workspace, matching what backupScheduler pushes. */
function scopeFor(target) {
  return `tenants/${target.id}`;
}

function human(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// --- commands ---------------------------------------------------------------

async function list() {
  const target = await resolveTarget();

  if (flag('offsite')) {
    const { isOffsiteConfigured, listSnapshots } = await import('../server/services/offsiteBackup.js');
    if (!isOffsiteConfigured()) {
      console.error('Off-box backups are not configured (set BACKUP_S3_BUCKET and credentials).');
      process.exitCode = 1;
      return;
    }
    const snapshots = await listSnapshots(scopeFor(target));
    if (snapshots.length === 0) {
      console.log(`No off-box snapshots for ${target.label}.`);
      return;
    }
    console.log(`Off-box snapshots for ${target.label}:`);
    for (const s of snapshots) {
      console.log(`${s.filename}  (${human(s.size)}, ${new Date(s.lastModified).toISOString()})`);
    }
    return;
  }

  if (!fs.existsSync(target.backupDir)) {
    console.log(`No backups directory for ${target.label} — none have been taken.`);
    return;
  }
  const files = fs
    .readdirSync(target.backupDir)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log(`No backups found for ${target.label}.`);
    return;
  }
  console.log(`Local backups for ${target.label}:`);
  for (const f of files) {
    const stat = fs.statSync(path.join(target.backupDir, f));
    console.log(`${f}  (${human(stat.size)}, ${stat.mtime.toISOString()})`);
  }
}

/**
 * Refuse to restore a file that isn't a healthy SQLite database. Copying a
 * truncated or corrupt snapshot over a live database turns a recoverable
 * incident into an unrecoverable one, so this runs before anything is touched.
 */
function assertRestorable(file) {
  let db;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`integrity_check returned "${integrity}"`);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', '_migrations')")
      .all()
      .map((r) => r.name);
    if (!tables.includes('users')) {
      throw new Error("no 'users' table — this does not look like a Marvelops database");
    }
    const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    return { users };
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

async function restore() {
  const filename = positional[0];
  if (!filename) {
    console.error('Usage: node scripts/backup-cli.mjs restore <filename> [--tenant <slug|id>] [--from-offsite]');
    console.error('Run "list" (optionally with --offsite) to see available snapshots.');
    process.exitCode = 1;
    return;
  }

  const target = await resolveTarget();
  const safeName = path.basename(filename);
  let src = path.join(target.backupDir, safeName);

  if (flag('from-offsite')) {
    const { isOffsiteConfigured, fetchSnapshot } = await import('../server/services/offsiteBackup.js');
    if (!isOffsiteConfigured()) {
      console.error('Off-box backups are not configured (set BACKUP_S3_BUCKET and credentials).');
      process.exitCode = 1;
      return;
    }
    fs.mkdirSync(target.backupDir, { recursive: true });
    console.log(`Downloading ${safeName} from off-box storage…`);
    src = await fetchSnapshot(scopeFor(target), safeName, target.backupDir);
    console.log(`Downloaded to ${src}`);
  }

  if (!fs.existsSync(src)) {
    console.error(`Backup not found: ${src}`);
    console.error('Run "list" (add --offsite to see off-box snapshots) to see what is available.');
    process.exitCode = 1;
    return;
  }

  let check;
  try {
    check = assertRestorable(src);
  } catch (err) {
    console.error(`Refusing to restore — the snapshot failed its integrity check: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Snapshot looks healthy (${check.users} user account(s)).`);

  if (!flag('yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `This will overwrite the database for ${target.label}:\n` +
        `  ${target.dbPath}\n` +
        `with ${safeName}.\n` +
        `Make sure the server is STOPPED first.\n` +
        `Type "yes" to continue: `,
    );
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted — nothing was changed.');
      return;
    }
  }

  // Keep a safety copy of whatever's live right now, in case the restore
  // itself needs undoing.
  fs.mkdirSync(target.backupDir, { recursive: true });
  if (fs.existsSync(target.dbPath)) {
    const preRestore = path.join(
      target.backupDir,
      `marvelops-pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`,
    );
    fs.copyFileSync(target.dbPath, preRestore);
    console.log(`Saved current database as ${path.basename(preRestore)} before restoring.`);
  }

  fs.mkdirSync(path.dirname(target.dbPath), { recursive: true });
  fs.copyFileSync(src, target.dbPath);
  // Stale WAL/SHM would otherwise be replayed on top of the restored file.
  for (const ext of ['-wal', '-shm']) {
    const stale = target.dbPath + ext;
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }

  console.log(`Restored ${safeName} -> ${target.dbPath}.`);
  console.log('Start the server now.');
}

// --- entry point ------------------------------------------------------------

try {
  if (command === 'list') {
    await list();
  } else if (command === 'restore') {
    await restore();
  } else {
    console.log('Usage:');
    console.log('  node scripts/backup-cli.mjs list    [--tenant <slug|id>] [--offsite]');
    console.log('  node scripts/backup-cli.mjs restore <filename> [--tenant <slug|id>] [--from-offsite] [--yes]');
    console.log('');
    console.log('Defaults to the primary workspace. --offsite lists what is stored in S3/R2;');
    console.log('--from-offsite downloads the snapshot before restoring it.');
    process.exitCode = command ? 1 : 0;
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
