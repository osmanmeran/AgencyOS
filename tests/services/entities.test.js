import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../server/db.js';
import {
  sanitizeEntityData,
  assertValidEntityType,
  parseFilter,
  isFilterSafe,
  userCanAccessEntity,
  applySort,
  mapRecord,
  updateEntity,
  createEntity,
} from '../../server/services/entities.js';

describe('Entities Service', () => {
  beforeAll(() => {
    getDb();
  });

  describe('sanitizeEntityData', () => {
    it('should strip prototype pollution keys', () => {
      const result = sanitizeEntityData({ name: 'test', constructor: {}, prototype: {} });
      expect(result.name).toBe('test');
      expect(Object.hasOwn(result, 'constructor')).toBe(false);
      expect(Object.hasOwn(result, 'prototype')).toBe(false);
    });

    it('should strip keys starting with $', () => {
      const result = sanitizeEntityData({ name: 'test', $where: '1=1', 'nested.key': 'value' });
      expect(result.name).toBe('test');
      expect(result.$where).toBeUndefined();
      expect(result['nested.key']).toBeUndefined();
    });

    it('should return non-object values as-is', () => {
      expect(sanitizeEntityData(null)).toBeNull();
      expect(sanitizeEntityData([1, 2, 3])).toEqual([1, 2, 3]);
    });
  });

  describe('assertValidEntityType', () => {
    it('should not throw for valid types', () => {
      expect(() => assertValidEntityType('Client')).not.toThrow();
      expect(() => assertValidEntityType('Trip')).not.toThrow();
    });

    it('should throw for unknown types', () => {
      expect(() => assertValidEntityType('NonExistentType')).toThrow('Unknown entity type');
    });

    it('should not expose OutlookToken (server-internal OAuth tokens) via the generic API', () => {
      expect(() => assertValidEntityType('OutlookToken')).toThrow('Unknown entity type');
    });
  });

  describe('parseFilter', () => {
    it('should parse valid JSON', () => {
      expect(parseFilter('{"name":"test"}')).toEqual({ name: 'test' });
    });

    it('should return null for invalid JSON', () => {
      expect(parseFilter('not json')).toBeNull();
    });

    it('should return null for empty input', () => {
      expect(parseFilter('')).toBeNull();
      expect(parseFilter(null)).toBeNull();
    });
  });

  describe('isFilterSafe', () => {
    it('should reject $ prefixed keys', () => {
      expect(isFilterSafe({ $gt: 5 })).toBe(false);
    });

    it('should reject dot-containing keys', () => {
      expect(isFilterSafe({ 'a.b': 5 })).toBe(false);
    });

    it('should allow safe keys', () => {
      expect(isFilterSafe({ name: 'test' })).toBe(true);
    });

    it('should accept valid operators', () => {
      expect(isFilterSafe({ price: { $gte: 100, $lte: 200 } })).toBe(true);
    });

    it('should reject invalid operators', () => {
      expect(isFilterSafe({ price: { $ne: 100 } })).toBe(false);
    });
  });

  describe('userCanAccessEntity', () => {
    const admin = { user_tier: 'admin' };
    const agent = { user_tier: 'agent', id: 'user1' };
    const otherAgent = { user_tier: 'agent', id: 'user2' };

    it('should grant admin access to everything', () => {
      expect(userCanAccessEntity(admin, 'Client', {})).toBe(true);
      expect(userCanAccessEntity(admin, 'Trip', {})).toBe(true);
    });

    it('should restrict user-scoped types to creator', () => {
      expect(userCanAccessEntity(agent, 'Message', { created_by: 'user1' })).toBe(true);
      expect(userCanAccessEntity(otherAgent, 'Message', { created_by: 'user1' })).toBe(false);
    });

    it('should restrict client-scoped types to linked client', () => {
      const clientUser = { user_tier: 'agent', client_id: 'client1' };
      expect(userCanAccessEntity(clientUser, 'Trip', { client_id: 'client1' })).toBe(true);
      expect(userCanAccessEntity(clientUser, 'Trip', { client_id: 'client2' })).toBe(false);
    });

    it('should let anyone authenticated read AppSettings, including client-portal accounts', () => {
      const clientUser = { user_tier: 'client', client_id: 'some-client' };
      expect(userCanAccessEntity(clientUser, 'AppSettings', { logo_url: 'https://example.com/logo.png' })).toBe(true);
    });

    it('should let a client-portal user read only the Company their own Client record belongs to', () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
        'test-client-with-company',
        'Client',
        JSON.stringify({ name: 'Test Contact', company_id: 'test-company-a' }),
        now,
        now,
      );

      const clientUser = { user_tier: 'client', client_id: 'test-client-with-company' };
      expect(userCanAccessEntity(clientUser, 'Company', { id: 'test-company-a' })).toBe(true);
      expect(userCanAccessEntity(clientUser, 'Company', { id: 'test-company-b' })).toBe(false);

      const orphanClientUser = { user_tier: 'client', client_id: 'no-such-client' };
      expect(userCanAccessEntity(orphanClientUser, 'Company', { id: 'test-company-a' })).toBe(false);
    });

    describe('staff read enforcement', () => {
      const agent = { user_tier: 'agent', id: 'agent1', custom_permissions: [] };
      const accounting = { user_tier: 'accounting', id: 'acct1', custom_permissions: [] };

      it('grants staff read via the mapped read permission', () => {
        // Both default tiers hold view_all_trips / view_invoices
        expect(userCanAccessEntity(agent, 'Trip', { created_by: 'someone-else' })).toBe(true);
        expect(userCanAccessEntity(accounting, 'Trip', { created_by: 'someone-else' })).toBe(true);
        expect(userCanAccessEntity(accounting, 'Invoice', { created_by: 'someone-else' })).toBe(true);
      });

      it('grants read when a modify permission implies it', () => {
        // Default agents hold modify_proposals but not the mapped read key (view_all_data)
        expect(userCanAccessEntity(agent, 'Proposal', { created_by: 'someone-else' })).toBe(true);
      });

      it('grants agents supplier/client reference data needed by their workflows', () => {
        // via modify_suppliers_basic / manage_pricing
        expect(userCanAccessEntity(agent, 'Supplier', { created_by: 'someone-else' })).toBe(true);
        // via create_trips / create_proposals
        expect(userCanAccessEntity(agent, 'Client', { created_by: 'someone-else' })).toBe(true);
        expect(userCanAccessEntity(agent, 'TourContract', { created_by: 'someone-else' })).toBe(true);
      });

      it('denies accounting types outside its read grants, except own records', () => {
        expect(userCanAccessEntity(accounting, 'Proposal', { created_by: 'someone-else' })).toBe(false);
        expect(userCanAccessEntity(accounting, 'Proposal', { created_by: 'acct1' })).toBe(true);
        expect(userCanAccessEntity(accounting, 'Supplier', { created_by: 'someone-else' })).toBe(false);
        expect(userCanAccessEntity(accounting, 'QuoteRequest', { created_by: 'someone-else' })).toBe(false);
      });

      it('honors custom permissions over tier defaults', () => {
        const acctWithGrant = { ...accounting, custom_permissions: ['view_all_data'] };
        expect(userCanAccessEntity(acctWithGrant, 'Proposal', { created_by: 'someone-else' })).toBe(true);
        expect(userCanAccessEntity(acctWithGrant, 'Supplier', { created_by: 'someone-else' })).toBe(true);
      });

      it('keeps unmapped types staff-readable', () => {
        expect(userCanAccessEntity(accounting, 'ServiceTemplate', { created_by: 'someone-else' })).toBe(true);
      });
    });
  });

  describe('AppSettings write gating', () => {
    it('rejects AppSettings writes from users without manage_app_settings', () => {
      const clientUser = { user_tier: 'client', id: 'c1', client_id: 'client1', custom_permissions: [] };
      const agent = { user_tier: 'agent', id: 'agent1', custom_permissions: [] };
      expect(() => createEntity('AppSettings', { app_name: 'Evil' }, clientUser)).toThrow(
        'Missing required permission',
      );
      expect(() => updateEntity('AppSettings', 'any-id', { tier_permissions: {} }, agent)).toThrow(
        'Missing required permission',
      );
    });

    it('allows AppSettings writes for admins', () => {
      const admin = { user_tier: 'admin', id: 'admin1', custom_permissions: [] };
      const created = createEntity('AppSettings', { app_name: 'Test Agency' }, admin);
      expect(created.app_name).toBe('Test Agency');
      const updated = updateEntity('AppSettings', created.id, { app_name: 'Renamed' }, admin);
      expect(updated.app_name).toBe('Renamed');
    });
  });

  describe('applySort', () => {
    it('should sort ascending by default', () => {
      const items = [{ name: 'b' }, { name: 'a' }, { name: 'c' }];
      const sorted = applySort(items, 'name');
      expect(sorted.map((i) => i.name)).toEqual(['a', 'b', 'c']);
    });

    it('should sort descending with - prefix', () => {
      const items = [{ name: 'b' }, { name: 'a' }, { name: 'c' }];
      const sorted = applySort(items, '-name');
      expect(sorted.map((i) => i.name)).toEqual(['c', 'b', 'a']);
    });

    it('should not mutate original array', () => {
      const items = [{ name: 'b' }, { name: 'a' }];
      const sorted = applySort(items, 'name');
      expect(items[0].name).toBe('b');
      expect(sorted[0].name).toBe('a');
    });
  });

  describe('mapRecord', () => {
    it('should parse data JSON and merge fields', () => {
      const record = { id: '123', data: '{"name":"test"}', created_date: '2024-01-01', updated_date: '2024-01-02' };
      const result = mapRecord(record);
      expect(result).toEqual({
        id: '123',
        name: 'test',
        created_date: '2024-01-01',
        updated_date: '2024-01-02',
      });
    });
  });
});
