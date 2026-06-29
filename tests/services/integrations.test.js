import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../server/db.js';
import { getOutlookStatus, disconnectOutlook } from '../../server/services/integrations.js';

describe('Integrations Service', () => {
  beforeAll(() => {
    getDb();
  });

  describe('getOutlookStatus', () => {
    it('should return disconnected for unknown user', () => {
      const status = getOutlookStatus('nonexistent-user');
      expect(status).toEqual({ connected: false });
    });
  });

  describe('disconnectOutlook', () => {
    it('should not throw for unknown user', () => {
      expect(() => disconnectOutlook('nonexistent-user')).not.toThrow();
    });
  });
});
