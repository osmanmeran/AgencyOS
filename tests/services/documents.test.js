import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../server/db.js';
import {
  saveDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  userCanAccessDocument,
} from '../../server/services/documents.js';

const db = getDb();
const adminUser = { id: 'u1', user_tier: 'admin' };
const otherClientUser = { id: 'u2', user_tier: 'agent', client_id: 'some-other-client' };

function cleanDocuments() {
  db.prepare('DELETE FROM documents').run();
  db.prepare("DELETE FROM entities WHERE type = 'Trip' AND id = 'p1'").run();
}

const fakeFile = {
  originalname: 'test.pdf',
  filename: 'stored_test.pdf',
  mimetype: 'application/pdf',
  size: 1024,
};

describe('Documents Service', () => {
  beforeAll(() => {
    cleanDocuments();
    // Documents are attached to a real entity; access is derived from that
    // entity, not a document-specific owner field, so tests need one to exist.
    const now = new Date().toISOString();
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
      'p1',
      'Trip',
      JSON.stringify({ client_id: 'client1' }),
      now,
      now,
    );
  });

  it('should save a document record', () => {
    const doc = saveDocument({ file: fakeFile, entityType: 'Trip', entityId: 'p1', userId: 'u1' });
    expect(doc.id).toBeTruthy();
    expect(doc.originalName).toBe('test.pdf');
    expect(doc.storedName).toBe('stored_test.pdf');
    expect(doc.url).toContain('/uploads/');
  });

  it('should list documents by entity', () => {
    const docs = getDocuments('Trip', 'p1', adminUser);
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs[0].entity_type).toBe('Trip');
  });

  it('should get document by id', () => {
    const docs = getDocuments('Trip', 'p1', adminUser);
    const found = getDocumentById(docs[0].id);
    expect(found).toBeTruthy();
    expect(found.id).toBe(docs[0].id);
  });

  it('should return null for non-existent document', () => {
    const found = getDocumentById('nonexistent');
    expect(found).toBeUndefined();
  });

  it("denies access to a user unrelated to the document's entity", () => {
    const docs = getDocuments('Trip', 'p1', adminUser);
    expect(userCanAccessDocument(otherClientUser, docs[0])).toBe(false);
  });

  it('throws for a caller listing without entity_type/entity_id unless admin/manager', () => {
    expect(() => getDocuments(undefined, undefined, otherClientUser)).toThrow();
    expect(() => getDocuments(undefined, undefined, adminUser)).not.toThrow();
  });

  it('should delete a document record', () => {
    const docs = getDocuments('Trip', 'p1', adminUser);
    const result = deleteDocument(docs[0].id);
    expect(result).toBeTruthy();
    const found = getDocumentById(docs[0].id);
    expect(found).toBeUndefined();
  });
});
