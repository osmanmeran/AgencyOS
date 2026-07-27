import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import logger from '../lib/logger.js';

// Off-box backups. Every local snapshot (server/services/backup.js) lives on the
// same disk as the database it protects, so a volume failure loses both. This
// service copies snapshots — and the uploaded files that the database refers to
// — to S3-compatible object storage (AWS S3, Cloudflare R2, MinIO…).
//
// Entirely opt-in: with no bucket configured every entry point is a no-op, so
// an existing deployment behaves exactly as before.
//
//   BACKUP_S3_BUCKET             enables the feature
//   BACKUP_S3_ACCESS_KEY_ID      credentials
//   BACKUP_S3_SECRET_ACCESS_KEY
//   BACKUP_S3_REGION             default 'auto' (what R2 expects)
//   BACKUP_S3_ENDPOINT           required for R2/MinIO, omit for AWS S3
//   BACKUP_S3_PREFIX             optional key prefix, e.g. 'marvelops/prod'
//   BACKUP_S3_KEEP               remote snapshots to retain per scope (default 30)

/** @returns {boolean} Whether off-box backups are configured. */
export function isOffsiteConfigured() {
  return Boolean(
    process.env.BACKUP_S3_BUCKET && process.env.BACKUP_S3_ACCESS_KEY_ID && process.env.BACKUP_S3_SECRET_ACCESS_KEY,
  );
}

/** @returns {number} How many remote snapshots to keep per scope. */
export function offsiteKeep() {
  const parsed = parseInt(process.env.BACKUP_S3_KEEP || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

let client = null;
let clientKey = '';

// Rebuilt when the relevant env changes so tests (and a config reload) aren't
// stuck with a client pointed at the previous bucket.
function s3() {
  const key = [
    process.env.BACKUP_S3_REGION,
    process.env.BACKUP_S3_ENDPOINT,
    process.env.BACKUP_S3_ACCESS_KEY_ID,
    process.env.BACKUP_S3_SECRET_ACCESS_KEY,
  ].join('|');
  if (client && clientKey === key) return client;
  client = new S3Client({
    region: process.env.BACKUP_S3_REGION || 'auto',
    ...(process.env.BACKUP_S3_ENDPOINT ? { endpoint: process.env.BACKUP_S3_ENDPOINT, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
    },
  });
  clientKey = key;
  return client;
}

function bucket() {
  return process.env.BACKUP_S3_BUCKET;
}

/** Join the configured prefix with `parts`, producing a normalised object key. */
export function offsiteKey(...parts) {
  const prefix = (process.env.BACKUP_S3_PREFIX || '').replace(/^\/+|\/+$/g, '');
  return [prefix, ...parts]
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

/** @returns {Promise<boolean>} Whether an object already exists at `key`. */
export async function objectExists(key) {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return false;
    throw err;
  }
}

/**
 * Upload a local file. Content is hashed and sent as ContentMD5 so a silently
 * truncated transfer is rejected by the server rather than stored as a corrupt
 * "backup" — the failure mode that makes a backup worse than none.
 * @returns {Promise<string>} The key written.
 */
export async function uploadFile(localPath, key) {
  const body = fs.readFileSync(localPath);
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentMD5: crypto.createHash('md5').update(body).digest('base64'),
    }),
  );
  return key;
}

/** @returns {Promise<Array<{Key: string, LastModified?: Date}>>} Every object under `prefix`. */
export async function listObjects(prefix) {
  const out = [];
  let token;
  do {
    const res = await s3().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    out.push(...(res.Contents || []));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/**
 * Push one database snapshot off-box.
 * @param {string} localPath Snapshot file on disk.
 * @param {string} scope Logical grouping, e.g. 'platform' or `tenants/<id>`.
 * @returns {Promise<string|null>} Key written, or null when not configured.
 */
export async function pushSnapshot(localPath, scope) {
  if (!isOffsiteConfigured()) return null;
  const key = offsiteKey('db', scope, path.basename(localPath));
  await uploadFile(localPath, key);
  logger.info({ key, scope }, 'Off-box snapshot uploaded');
  return key;
}

/**
 * Mirror a directory of uploaded files. Stored uploads are immutable once
 * written, so anything already present remotely is skipped — the nightly run
 * costs one HEAD per file instead of re-uploading the whole corpus. Remote
 * copies are never pruned: they are the off-box copy of live data, not a
 * rotating snapshot.
 * @returns {Promise<{uploaded: number, skipped: number, failed: number}>}
 */
export async function syncDirectory(localDir, scope) {
  const result = { uploaded: 0, skipped: 0, failed: 0 };
  if (!isOffsiteConfigured() || !fs.existsSync(localDir)) return result;

  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const localPath = path.join(localDir, entry.name);
    const key = offsiteKey('files', scope, entry.name);
    try {
      if (await objectExists(key)) {
        result.skipped += 1;
        continue;
      }
      await uploadFile(localPath, key);
      result.uploaded += 1;
    } catch (err) {
      // One unreadable/rejected file must not abort the rest of the sync.
      result.failed += 1;
      logger.error({ err: err.message, key }, 'Off-box file sync failed for one file');
    }
  }
  return result;
}

/**
 * Delete all but the newest `keep` snapshots under a scope. Only touches the
 * `db/` namespace — synced files are never pruned.
 * @returns {Promise<string[]>} Keys removed.
 */
export async function pruneSnapshots(scope, keep = offsiteKeep()) {
  if (!isOffsiteConfigured()) return [];
  const prefix = offsiteKey('db', scope) + '/';
  const objects = await listObjects(prefix);
  const sorted = objects
    .filter((o) => o.Key?.endsWith('.db'))
    .sort((a, b) => new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime());

  const stale = sorted.slice(keep);
  if (stale.length === 0) return [];

  await s3().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: stale.map((o) => ({ Key: o.Key })) },
    }),
  );
  logger.info({ scope, removed: stale.length }, 'Pruned off-box snapshots');
  return stale.map((o) => o.Key);
}

/**
 * Verify the configuration end-to-end by round-tripping a small object.
 * Used by the CLI so misconfiguration surfaces on demand rather than being
 * discovered the night a restore is needed.
 * @returns {Promise<{ok: boolean, bucket?: string, key?: string, error?: string}>}
 */
export async function verifyOffsite() {
  if (!isOffsiteConfigured()) {
    return { ok: false, error: 'Off-box backups are not configured (set BACKUP_S3_BUCKET and credentials).' };
  }
  const key = offsiteKey('healthcheck', `probe-${Date.now()}.txt`);
  try {
    await s3().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: Buffer.from('marvelops offsite backup probe\n') }),
    );
    const exists = await objectExists(key);
    await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: [{ Key: key }] } }));
    return exists
      ? { ok: true, bucket: bucket(), key }
      : { ok: false, error: 'Wrote the probe but could not read it back.' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
