import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../server/db.js';
import { saveDocument, getDocuments, getDocumentById, deleteDocument } from '../../server/services/documents.js';

const db = getDb();

function cleanDocuments() {
  db.prepare('DELETE FROM documents').run();
}

const fakeFile = {
  originalname: 'test.pdf',
  filename: 'stored_test.pdf',
  mimetype: 'application/pdf',
  size: 1024,
};

describe('Documents Service', () => {
  beforeAll(() => cleanDocuments());

  it('should save a document record', () => {
    const doc = saveDocument({ file: fakeFile, entityType: 'proposal', entityId: 'p1', userId: 'u1' });
    expect(doc.id).toBeTruthy();
    expect(doc.originalName).toBe('test.pdf');
    expect(doc.storedName).toBe('stored_test.pdf');
    expect(doc.url).toContain('/uploads/');
  });

  it('should list documents by entity', () => {
    const docs = getDocuments('proposal', 'p1');
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs[0].entity_type).toBe('proposal');
  });

  it('should get document by id', () => {
    const docs = getDocuments('proposal', 'p1');
    const found = getDocumentById(docs[0].id);
    expect(found).toBeTruthy();
    expect(found.id).toBe(docs[0].id);
  });

  it('should return null for non-existent document', () => {
    const found = getDocumentById('nonexistent');
    expect(found).toBeUndefined();
  });

  it('should delete a document record', () => {
    const docs = getDocuments('proposal', 'p1');
    const result = deleteDocument(docs[0].id);
    expect(result).toBeTruthy();
    const found = getDocumentById(docs[0].id);
    expect(found).toBeUndefined();
  });
});
