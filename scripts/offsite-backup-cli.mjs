// Off-box (S3/R2) backup CLI — see server/services/offsiteBackup.js.
//
// Local snapshots sit on the same disk as the database, so they don't survive a
// volume loss. These commands verify the off-box copy is actually working and
// let you push one on demand rather than waiting for the nightly run.
//
//   node scripts/offsite-backup-cli.mjs verify   # round-trip a probe object
//   node scripts/offsite-backup-cli.mjs list     # what's stored off-box
//   node scripts/offsite-backup-cli.mjs push     # snapshot + upload everything now
//
// Configure with BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID,
// BACKUP_S3_SECRET_ACCESS_KEY and (for R2/MinIO) BACKUP_S3_ENDPOINT.

import path from 'path';
import {
  isOffsiteConfigured,
  verifyOffsite,
  listObjects,
  offsiteKey,
  pushSnapshot,
  syncDirectory,
  pruneSnapshots,
  offsiteKeep,
} from '../server/services/offsiteBackup.js';

const command = process.argv[2] || 'verify';

function requireConfigured() {
  if (isOffsiteConfigured()) return true;
  console.error('Off-box backups are not configured.');
  console.error('Set BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY');
  console.error('(plus BACKUP_S3_ENDPOINT for Cloudflare R2 or MinIO).');
  process.exitCode = 1;
  return false;
}

function human(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function verify() {
  const result = await verifyOffsite();
  if (result.ok) {
    console.log(`OK — wrote, read back and deleted a probe object in "${result.bucket}".`);
    console.log(`Retention: keeping the newest ${offsiteKeep()} snapshots per scope.`);
  } else {
    console.error(`FAILED — ${result.error}`);
    process.exitCode = 1;
  }
}

async function list() {
  if (!requireConfigured()) return;
  const objects = await listObjects(offsiteKey());
  if (objects.length === 0) {
    console.log('Nothing stored off-box yet. Run "push" or wait for the nightly backup.');
    return;
  }
  const snapshots = objects.filter((o) => o.Key.includes('/db/') || o.Key.startsWith('db/'));
  const files = objects.length - snapshots.length;
  for (const o of snapshots.sort((a, b) => (a.Key < b.Key ? -1 : 1))) {
    console.log(`${o.Key}  (${human(o.Size)}, ${new Date(o.LastModified).toISOString()})`);
  }
  console.log(`\n${snapshots.length} snapshot(s), ${files} synced file(s).`);
}

async function push() {
  if (!requireConfigured()) return;
  // Imported lazily: this opens the databases, which the read-only commands
  // above have no reason to do.
  const { getDb, getPlatformDb, getDataDir, getTenantsDir, getUploadDir, getPdfDir, DEFAULT_TENANT_ID, closeDb } =
    await import('../server/db.js');
  const { allTenantIds } = await import('../server/services/tenants.js');
  const { createBackupAsync } = await import('../server/services/backup.js');

  const scopes = [
    { id: DEFAULT_TENANT_ID, dataDir: getDataDir(), scope: `tenants/${DEFAULT_TENANT_ID}`, label: 'manual' },
    ...allTenantIds()
      .filter((id) => id !== DEFAULT_TENANT_ID)
      .map((id) => ({
        id,
        dataDir: path.join(getTenantsDir(), String(id)),
        scope: `tenants/${id}`,
        label: 'manual',
      })),
  ];

  for (const { id, dataDir, scope, label } of scopes) {
    const dest = await createBackupAsync(getDb(id), dataDir, label);
    const key = await pushSnapshot(dest, scope);
    console.log(`pushed ${key}`);
    await pruneSnapshots(scope);

    const uploads = await syncDirectory(getUploadDir(id), `${scope}/uploads`);
    const pdfs = await syncDirectory(getPdfDir(id), `${scope}/pdfs`);
    console.log(
      `  files: ${uploads.uploaded + pdfs.uploaded} uploaded, ` +
        `${uploads.skipped + pdfs.skipped} already present, ${uploads.failed + pdfs.failed} failed`,
    );
  }

  const platformDest = await createBackupAsync(getPlatformDb(), getDataDir(), 'platform-manual');
  console.log(`pushed ${await pushSnapshot(platformDest, 'platform')}`);
  await pruneSnapshots('platform');

  closeDb();
  console.log('\nDone.');
}

const commands = { verify, list, push };

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  console.error('Usage: node scripts/offsite-backup-cli.mjs [verify|list|push]');
  process.exitCode = 1;
} else {
  await commands[command]();
}
