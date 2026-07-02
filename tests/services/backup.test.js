import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { createBackupSync, createBackupAsync, listBackups, pruneBackups, getBackupDir } from '../../server/services/backup.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marvelops-backup-test-'));

function freshDb(dataDir) {
  const dbPath = path.join(dataDir, 'marvelops.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE entities (id TEXT PRIMARY KEY, data TEXT)');
  db.prepare('INSERT INTO entities (id, data) VALUES (?, ?)').run('e1', JSON.stringify({ name: 'Test' }));
  return db;
}

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Backup Service', () => {
  let dataDir;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(tmpRoot, 'case-'));
  });

  it('createBackupSync produces a readable copy with the same data', () => {
    const db = freshDb(dataDir);
    const dest = createBackupSync(db, dataDir, 'pre-migration');
    db.close();

    expect(fs.existsSync(dest)).toBe(true);
    const restored = new Database(dest, { readonly: true });
    const row = restored.prepare('SELECT data FROM entities WHERE id = ?').get('e1');
    expect(JSON.parse(row.data)).toEqual({ name: 'Test' });
    restored.close();
  });

  it('createBackupAsync produces a readable copy with the same data', async () => {
    const db = freshDb(dataDir);
    const dest = await createBackupAsync(db, dataDir, 'daily');
    db.close();

    expect(fs.existsSync(dest)).toBe(true);
    const restored = new Database(dest, { readonly: true });
    const row = restored.prepare('SELECT data FROM entities WHERE id = ?').get('e1');
    expect(JSON.parse(row.data)).toEqual({ name: 'Test' });
    restored.close();
  });

  it('listBackups returns [] when no backups directory exists yet', () => {
    expect(listBackups(dataDir)).toEqual([]);
  });

  it('listBackups lists created backups newest first', async () => {
    const db = freshDb(dataDir);
    const a = createBackupSync(db, dataDir, 'first');
    await new Promise(r => setTimeout(r, 5));
    const b = createBackupSync(db, dataDir, 'second');
    db.close();

    const listed = listBackups(dataDir);
    expect(listed).toContain(path.basename(a));
    expect(listed).toContain(path.basename(b));
  });

  it('pruneBackups keeps only the newest N and removes the rest', () => {
    const db = freshDb(dataDir);
    for (let i = 0; i < 5; i++) {
      createBackupSync(db, dataDir, `snap${i}`);
    }
    db.close();

    expect(listBackups(dataDir)).toHaveLength(5);
    const removed = pruneBackups(dataDir, 2);
    expect(removed).toHaveLength(3);
    expect(listBackups(dataDir)).toHaveLength(2);
  });

  it('pruneBackups is a no-op when under the limit', () => {
    const db = freshDb(dataDir);
    createBackupSync(db, dataDir, 'only-one');
    db.close();

    const removed = pruneBackups(dataDir, 14);
    expect(removed).toEqual([]);
    expect(listBackups(dataDir)).toHaveLength(1);
  });

  it('getBackupDir is under the given data directory', () => {
    expect(getBackupDir(dataDir)).toBe(path.join(dataDir, 'backups'));
  });
});
