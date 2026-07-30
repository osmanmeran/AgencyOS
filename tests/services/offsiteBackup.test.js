import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The S3 client is mocked: these tests pin our own logic (opt-in gating, key
// layout, incremental skipping, retention) rather than the AWS SDK's.
const sent = [];
let headBehaviour = () => {
  const err = new Error('NotFound');
  err.$metadata = { httpStatusCode: 404 };
  throw err;
};
let listResponse = () => ({ Contents: [], IsTruncated: false });

vi.mock('@aws-sdk/client-s3', () => {
  class Command {
    constructor(input) {
      this.input = input;
      this.name = this.constructor.commandName;
    }
  }
  class PutObjectCommand extends Command {}
  PutObjectCommand.commandName = 'PutObject';
  class HeadObjectCommand extends Command {}
  HeadObjectCommand.commandName = 'HeadObject';
  class ListObjectsV2Command extends Command {}
  ListObjectsV2Command.commandName = 'ListObjectsV2';
  class DeleteObjectsCommand extends Command {}
  DeleteObjectsCommand.commandName = 'DeleteObjects';

  class S3Client {
    async send(command) {
      sent.push({ name: command.name, input: command.input });
      if (command.name === 'HeadObject') return headBehaviour(command.input);
      if (command.name === 'ListObjectsV2') return listResponse(command.input);
      return {};
    }
  }
  return { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand };
});

const { isOffsiteConfigured, offsiteKey, pushSnapshot, syncDirectory, pruneSnapshots, verifyOffsite, offsiteKeep } =
  await import('../../server/services/offsiteBackup.js');

let tmpDir;

function configure(extra = {}) {
  process.env.BACKUP_S3_BUCKET = 'test-bucket';
  process.env.BACKUP_S3_ACCESS_KEY_ID = 'key';
  process.env.BACKUP_S3_SECRET_ACCESS_KEY = 'secret';
  for (const [k, v] of Object.entries(extra)) process.env[k] = v;
}

function unconfigure() {
  for (const k of [
    'BACKUP_S3_BUCKET',
    'BACKUP_S3_ACCESS_KEY_ID',
    'BACKUP_S3_SECRET_ACCESS_KEY',
    'BACKUP_S3_PREFIX',
    'BACKUP_S3_KEEP',
  ]) {
    delete process.env[k];
  }
}

beforeEach(() => {
  sent.length = 0;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marvelops-offsite-'));
  headBehaviour = () => {
    const err = new Error('NotFound');
    err.$metadata = { httpStatusCode: 404 };
    throw err;
  };
  listResponse = () => ({ Contents: [], IsTruncated: false });
  unconfigure();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  unconfigure();
});

describe('off-box backup configuration', () => {
  it('is disabled until a bucket and credentials are set', () => {
    expect(isOffsiteConfigured()).toBe(false);
    process.env.BACKUP_S3_BUCKET = 'b';
    expect(isOffsiteConfigured()).toBe(false); // credentials still missing
    configure();
    expect(isOffsiteConfigured()).toBe(true);
  });

  it('every entry point is a no-op while unconfigured', async () => {
    const file = path.join(tmpDir, 'snap.db');
    fs.writeFileSync(file, 'data');

    expect(await pushSnapshot(file, 'tenants/0')).toBeNull();
    expect(await syncDirectory(tmpDir, 'tenants/0')).toEqual({ uploaded: 0, skipped: 0, failed: 0 });
    expect(await pruneSnapshots('tenants/0')).toEqual([]);
    expect((await verifyOffsite()).ok).toBe(false);
    expect(sent).toHaveLength(0); // nothing ever reached the network
  });

  it('applies the configured prefix to keys', () => {
    configure({ BACKUP_S3_PREFIX: '/marvelops/prod/' });
    expect(offsiteKey('db', 'platform', 'x.db')).toBe('marvelops/prod/db/platform/x.db');
  });

  it('reads the retention setting, falling back to 30', () => {
    expect(offsiteKeep()).toBe(30);
    process.env.BACKUP_S3_KEEP = '5';
    expect(offsiteKeep()).toBe(5);
    process.env.BACKUP_S3_KEEP = 'nonsense';
    expect(offsiteKeep()).toBe(30);
  });
});

describe('pushSnapshot', () => {
  it('uploads under db/<scope>/<filename> with a content hash', async () => {
    configure();
    const file = path.join(tmpDir, 'marvelops-daily-2026.db');
    fs.writeFileSync(file, 'snapshot bytes');

    const key = await pushSnapshot(file, 'tenants/abc');
    expect(key).toBe('db/tenants/abc/marvelops-daily-2026.db');

    const put = sent.find((s) => s.name === 'PutObject');
    expect(put.input.Bucket).toBe('test-bucket');
    expect(put.input.ContentMD5).toBeTruthy();
    expect(put.input.Body.toString()).toBe('snapshot bytes');
  });
});

describe('syncDirectory', () => {
  it('uploads files that are not already off-box', async () => {
    configure();
    fs.writeFileSync(path.join(tmpDir, 'a.pdf'), 'a');
    fs.writeFileSync(path.join(tmpDir, 'b.pdf'), 'b');

    const result = await syncDirectory(tmpDir, 'tenants/abc/pdfs');
    expect(result).toEqual({ uploaded: 2, skipped: 0, failed: 0 });
    expect(
      sent
        .filter((s) => s.name === 'PutObject')
        .map((s) => s.input.Key)
        .sort(),
    ).toEqual(['files/tenants/abc/pdfs/a.pdf', 'files/tenants/abc/pdfs/b.pdf']);
  });

  it('skips files already present remotely (uploads are immutable)', async () => {
    configure();
    fs.writeFileSync(path.join(tmpDir, 'already-there.pdf'), 'x');
    headBehaviour = () => ({}); // HEAD succeeds -> object exists

    const result = await syncDirectory(tmpDir, 'tenants/abc/pdfs');
    expect(result).toEqual({ uploaded: 0, skipped: 1, failed: 0 });
    expect(sent.some((s) => s.name === 'PutObject')).toBe(false);
  });

  it('counts a failed file and keeps going', async () => {
    configure();
    fs.writeFileSync(path.join(tmpDir, 'one.pdf'), '1');
    fs.writeFileSync(path.join(tmpDir, 'two.pdf'), '2');
    let calls = 0;
    headBehaviour = () => {
      calls += 1;
      if (calls === 1) throw new Error('transient S3 failure');
      const err = new Error('NotFound');
      err.$metadata = { httpStatusCode: 404 };
      throw err;
    };

    const result = await syncDirectory(tmpDir, 'tenants/abc/pdfs');
    expect(result.failed).toBe(1);
    expect(result.uploaded).toBe(1);
  });

  it('ignores subdirectories and a missing directory', async () => {
    configure();
    fs.mkdirSync(path.join(tmpDir, 'nested'));
    fs.writeFileSync(path.join(tmpDir, 'nested', 'deep.pdf'), 'deep');

    expect(await syncDirectory(tmpDir, 's')).toEqual({ uploaded: 0, skipped: 0, failed: 0 });
    expect(await syncDirectory(path.join(tmpDir, 'does-not-exist'), 's')).toEqual({
      uploaded: 0,
      skipped: 0,
      failed: 0,
    });
  });
});

describe('pruneSnapshots', () => {
  it('deletes all but the newest N snapshots', async () => {
    configure();
    listResponse = () => ({
      Contents: [
        { Key: 'db/tenants/abc/old1.db', LastModified: new Date('2026-01-01') },
        { Key: 'db/tenants/abc/new.db', LastModified: new Date('2026-06-01') },
        { Key: 'db/tenants/abc/old2.db', LastModified: new Date('2026-02-01') },
      ],
      IsTruncated: false,
    });

    const removed = await pruneSnapshots('tenants/abc', 1);
    expect(removed).toEqual(['db/tenants/abc/old2.db', 'db/tenants/abc/old1.db']);

    const del = sent.find((s) => s.name === 'DeleteObjects');
    expect(del.input.Delete.Objects).toHaveLength(2);
  });

  it('does nothing when under the retention limit', async () => {
    configure();
    listResponse = () => ({
      Contents: [{ Key: 'db/platform/only.db', LastModified: new Date() }],
      IsTruncated: false,
    });

    expect(await pruneSnapshots('platform', 14)).toEqual([]);
    expect(sent.some((s) => s.name === 'DeleteObjects')).toBe(false);
  });
});

describe('verifyOffsite', () => {
  it('round-trips a probe object and cleans it up', async () => {
    configure();
    headBehaviour = () => ({}); // the probe reads back
    const result = await verifyOffsite();
    expect(result.ok).toBe(true);
    expect(sent.map((s) => s.name)).toEqual(['PutObject', 'HeadObject', 'DeleteObjects']);
  });

  it('reports failure when the probe cannot be read back', async () => {
    configure();
    const result = await verifyOffsite();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not read it back/i);
  });

  it('surfaces the underlying error message', async () => {
    configure();
    headBehaviour = () => {
      throw new Error('AccessDenied');
    };
    const result = await verifyOffsite();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('AccessDenied');
  });
});
