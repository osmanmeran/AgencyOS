import fs from 'fs';
import path from 'path';

export function getBackupDir(dataDir) {
  return path.join(dataDir, 'backups');
}

function backupFilename(label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `marvelops-${label}-${timestamp}.db`;
}

// Synchronous — safe to call from db.js's module-level init, before the
// server (and any concurrent writers) exist yet. Checkpoints the WAL file
// into the main .db first so the copy isn't missing recent writes.
export function createBackupSync(db, dataDir, label) {
  const dir = getBackupDir(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  db.pragma('wal_checkpoint(TRUNCATE)');
  const dest = path.join(dir, backupFilename(label));
  fs.copyFileSync(db.name, dest);
  return dest;
}

// Async — uses SQLite's official online backup API (safe against a live
// database under concurrent writes), used by the daily scheduler while the
// app is serving traffic.
export async function createBackupAsync(db, dataDir, label) {
  const dir = getBackupDir(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, backupFilename(label));
  await db.backup(dest);
  return dest;
}

export function listBackups(dataDir) {
  const dir = getBackupDir(dataDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse();
}

// Keeps the newest `keep` backups, deletes the rest. Returns the filenames
// that were removed.
export function pruneBackups(dataDir, keep = 14) {
  const dir = getBackupDir(dataDir);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const toRemove = files.slice(keep);
  for (const f of toRemove) fs.unlinkSync(path.join(dir, f.name));
  return toRemove.map(f => f.name);
}
