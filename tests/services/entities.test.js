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
  deleteEntity,
  findEntityById,
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

  describe('Task ownership permission bypass', () => {
    it('lets an agent (no modify_trips/delete_trips) complete and delete their own assigned task', () => {
      const manager = { user_tier: 'manager', id: 'mgr1', custom_permissions: [] };
      const agent = { user_tier: 'agent', id: 'agent-owner', custom_permissions: [] };
      // agent lacks modify_trips/delete_trips, but create_trips is enough to create the task itself
      const task = createEntity('Task', { title: 'My task', assigned_to_user_id: 'agent-owner' }, agent);

      const updated = updateEntity('Task', task.id, { status: 'completed' }, agent);
      expect(updated.status).toBe('completed');

      expect(() => deleteEntity('Task', task.id, agent)).not.toThrow();
      expect(() => updateEntity('Task', 'nonexistent-id', { status: 'completed' }, manager)).toThrow(
        'Record not found',
      );
    });

    it('still blocks an agent from updating/deleting a task assigned to someone else', () => {
      const admin = { user_tier: 'admin', id: 'admin1', custom_permissions: [] };
      const agent = { user_tier: 'agent', id: 'agent-bystander', custom_permissions: [] };
      const task = createEntity('Task', { title: "Someone else's task", assigned_to_user_id: 'other-user' }, admin);

      expect(() => updateEntity('Task', task.id, { status: 'completed' }, agent)).toThrow(
        'Missing required permission',
      );
      expect(() => deleteEntity('Task', task.id, agent)).toThrow('Missing required permission');
    });

    it('lets a manager (has modify_trips) update any task regardless of ownership', () => {
      const admin = { user_tier: 'admin', id: 'admin2', custom_permissions: [] };
      const manager = { user_tier: 'manager', id: 'mgr2', custom_permissions: [] };
      const task = createEntity('Task', { title: 'Unowned task', assigned_to_user_id: 'someone-else' }, admin);

      const updated = updateEntity('Task', task.id, { status: 'in_progress' }, manager);
      expect(updated.status).toBe('in_progress');
    });

    it('lets an admin (has delete_trips) delete any task regardless of ownership', () => {
      const admin = { user_tier: 'admin', id: 'admin3', custom_permissions: [] };
      const task = createEntity('Task', { title: 'Unowned task 2', assigned_to_user_id: 'someone-else' }, admin);

      expect(() => deleteEntity('Task', task.id, admin)).not.toThrow();
    });
  });

  describe('derived Task field stripping', () => {
    const admin = { user_tier: 'admin', id: 'admin-derived', custom_permissions: [] };

    it('drops server-computed SLA flags from a create payload', () => {
      const task = createEntity(
        'Task',
        { title: 'New task', is_overdue: true, is_due_soon: true, is_escalated: true },
        admin,
      );
      const stored = findEntityById('Task', task.id, admin);
      expect(stored.is_overdue).toBeUndefined();
      expect(stored.is_due_soon).toBeUndefined();
      expect(stored.is_escalated).toBeUndefined();
      expect(stored.title).toBe('New task');
    });

    it('ignores SLA flags echoed back on update, keeping the escalation engine authoritative', () => {
      const task = createEntity('Task', { title: 'Board task', status: 'pending' }, admin);
      // What the Task Board's drag-and-drop used to send: a whole enriched task
      // object, SLA flags included. Only the real edit must land.
      const updated = updateEntity(
        'Task',
        task.id,
        { ...task, status: 'in_progress', is_overdue: true, is_due_soon: true, is_escalated: true },
        admin,
      );
      expect(updated.status).toBe('in_progress');
      expect(updated.is_overdue).toBeUndefined();
      expect(updated.is_due_soon).toBeUndefined();
      expect(updated.is_escalated).toBeUndefined();
    });

    it('leaves an already-persisted is_escalated intact (the engine writes it, clients cannot)', () => {
      const task = createEntity('Task', { title: 'Escalated task' }, admin);
      // checkEscalations() persists the flag with direct SQL, bypassing this layer.
      const db = getDb();
      const row = db.prepare('SELECT data FROM entities WHERE id = ?').get(task.id);
      db.prepare('UPDATE entities SET data = ? WHERE id = ?').run(
        JSON.stringify({ ...JSON.parse(row.data), is_escalated: true }),
        task.id,
      );

      const updated = updateEntity('Task', task.id, { title: 'Renamed', is_escalated: false }, admin);
      expect(updated.title).toBe('Renamed');
      expect(updated.is_escalated).toBe(true);
    });

    it('does not strip these fields from other entity types', () => {
      const client = createEntity('Client', { name: 'Acme', is_overdue: true }, admin);
      expect(client.is_overdue).toBe(true);
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
