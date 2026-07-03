// Lists and restores local SQLite backups (see server/services/backup.js
// and server/services/backupScheduler.js for how they're created).
//
// Run this from inside the production environment (where data/marvelops.db
// lives on the persistent volume), e.g.:
//   railway ssh
//   node scripts/backup-cli.mjs list
//   node scripts/backup-cli.mjs restore marvelops-daily-2026-07-01T00-00-00-000Z.db
//
// IMPORTANT: stop the server before restoring. This script only touches
// files on disk — if the server is still running with the database open,
// overwriting it here will not take effect until restart and may leave
// the running process and the file on disk out of sync.

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No backups directory yet — none have been taken.');
    return [];
  }
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('No backups found.');
    return [];
  }

  for (const f of files) {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    console.log(`${f}  (${(stat.size / 1024).toFixed(0)} KB, ${stat.mtime.toISOString()})`);
  }
  return files;
}

async function restoreBackup(filename) {
  if (!filename) {
    console.error('Usage: node scripts/backup-cli.mjs restore <filename>');
    console.error('Run "node scripts/backup-cli.mjs list" to see available backups.');
    process.exitCode = 1;
    return;
  }

  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) {
    console.error(`Backup not found: ${filename}`);
    console.error('Run "node scripts/backup-cli.mjs list" to see available backups.');
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `This will overwrite ${DB_PATH} with ${filename}.\n` +
    `Make sure the server is STOPPED first.\n` +
    `Type "yes" to continue: `
  );
  rl.close();

  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted — nothing was changed.');
    return;
  }

  // Keep a safety copy of whatever's live right now, in case the restore
  // itself needs undoing.
  if (fs.existsSync(DB_PATH)) {
    const preRestore = path.join(BACKUP_DIR, `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    fs.copyFileSync(DB_PATH, preRestore);
    console.log(`Saved current database as ${path.basename(preRestore)} before restoring.`);
  }

  fs.copyFileSync(src, DB_PATH);
  for (const ext of ['-wal', '-shm']) {
    const stale = DB_PATH + ext;
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }

  console.log(`Restored ${filename} -> ${DB_PATH}.`);
  console.log('Start the server now.');
}

const [, , command, arg] = process.argv;

if (command === 'list') {
  listBackups();
} else if (command === 'restore') {
  await restoreBackup(arg);
} else {
  console.log('Usage:');
  console.log('  node scripts/backup-cli.mjs list');
  console.log('  node scripts/backup-cli.mjs restore <filename>');
}
