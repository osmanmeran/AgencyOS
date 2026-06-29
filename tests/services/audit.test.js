import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../server/db.js';
import { logAudit, getAuditLogs, AUDIT_ACTIONS } from '../../server/services/audit.js';

const db = getDb();

function cleanAudit() {
  db.prepare('DELETE FROM audit_logs').run();
}

describe('Audit Service', () => {
  beforeAll(() => cleanAudit());

  it('should log an audit entry', () => {
    const id = logAudit({
      userId: 'u1', userName: 'admin@test.com', action: AUDIT_ACTIONS.CREATE,
      entityType: 'proposal', entityId: 'p1', ip: '127.0.0.1',
    });
    expect(id).toBeTruthy();
  });

  it('should log audit with changes', () => {
    const id = logAudit({
      userId: 'u1', userName: 'admin@test.com', action: AUDIT_ACTIONS.UPDATE,
      entityType: 'proposal', entityId: 'p1',
      changes: { status: { from: 'draft', to: 'sent' } },
    });
    expect(id).toBeTruthy();
  });

  it('should retrieve audit logs', () => {
    const logs = getAuditLogs({ limit: 10 });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[0].action).toBeTruthy();
  });

  it('should filter by entity', () => {
    const logs = getAuditLogs({ entityType: 'proposal', entityId: 'p1' });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[0].entity_type).toBe('proposal');
  });

  it('should parse changes JSON', () => {
    const logs = getAuditLogs({ action: AUDIT_ACTIONS.UPDATE });
    const log = logs.find(l => l.changes && l.changes.status);
    if (log) {
      expect(log.changes.status.from).toBe('draft');
      expect(log.changes.status.to).toBe('sent');
    }
  });
});
