import { describe, it, expect, afterAll } from 'vitest';
import { getDb } from '../../server/db.js';
import {
  assertValidEntityType,
  createEntity,
  updateEntity,
  deleteEntity,
  findEntities,
  userCanAccessEntity,
} from '../../server/services/entities.js';

const admin = { user_tier: 'admin', id: 'test-admin-gt', custom_permissions: [] };
const manager = { user_tier: 'manager', id: 'test-manager-gt', custom_permissions: [] };
// Agents were intentionally NOT granted guided-tour permissions by default.
const agentNoPerm = { user_tier: 'agent', id: 'test-agent-no-gt', custom_permissions: [] };
const agentWithView = { user_tier: 'agent', id: 'test-agent-view-gt', custom_permissions: ['view_guided_tours'] };
const agentWithManage = {
  user_tier: 'agent',
  id: 'test-agent-manage-gt',
  custom_permissions: ['manage_guided_tours'],
};

const createdIds = [];

async function cleanup() {
  for (const id of createdIds) {
    try {
      deleteEntity('GuidedTour', id, admin);
    } catch {
      /* already gone */
    }
  }
}

describe('GuidedTour entity', () => {
  afterAll(cleanup);

  it('is a registered entity type', () => {
    expect(() => assertValidEntityType('GuidedTour')).not.toThrow();
    expect(() => assertValidEntityType('NonExistentType')).toThrow('Unknown entity type');
  });

  it('creates a daily tour with all daily fields', () => {
    const tour = createEntity(
      'GuidedTour',
      {
        name: 'Old City Walk',
        mode: 'daily',
        language: 'en',
        location: 'Sultanahmet',
        startingTime: '09:30',
        sights: ['Hagia Sophia', 'Topkapi Palace'],
        mealTreatment: 'Lunch included',
        transportation: true,
        tourStyle: 'regular',
        minOccupancy: 2,
        maxOccupancy: 15,
        pricingTiers: [
          { minParticipants: 2, maxParticipants: 5, price: 40 },
          { minParticipants: 6, maxParticipants: 15, price: 30 },
        ],
      },
      admin,
    );
    createdIds.push(tour.id);

    expect(tour.id).toBeTruthy();
    expect(tour.mode).toBe('daily');
    expect(tour.tourStyle).toBe('regular');
    expect(tour.transportation).toBe(true);
    expect(tour.sights).toEqual(['Hagia Sophia', 'Topkapi Palace']);
    expect(tour.pricingTiers).toHaveLength(2);
    expect(tour.created_by).toBe(admin.id);
  });

  it('creates a multi-day tour with start/end locations and per-night lodging', () => {
    const tour = createEntity(
      'GuidedTour',
      {
        name: 'Cappadocia Explorer',
        mode: 'multiday',
        language: 'tr',
        startingTime: '08:00',
        startLocation: 'Istanbul',
        endLocation: 'Cappadocia',
        mealTreatment: 'Breakfast included',
        transportation: true,
        minOccupancy: 1,
        maxOccupancy: 8,
        pricingTiers: [{ minParticipants: 1, maxParticipants: 8, price: 350 }],
        nights: [
          { day: 1, lodging: 'Sultan Cave Suites', hotelMealTreatment: 'Breakfast included' },
          { day: 2, lodging: 'Museum Hotel', hotelMealTreatment: 'Half board' },
        ],
      },
      manager,
    );
    createdIds.push(tour.id);

    expect(tour.mode).toBe('multiday');
    expect(tour.startLocation).toBe('Istanbul');
    expect(tour.endLocation).toBe('Cappadocia');
    expect(tour.nights).toHaveLength(2);
    expect(tour.nights[0].lodging).toBe('Sultan Cave Suites');
    expect(tour.nights[1].hotelMealTreatment).toBe('Half board');
  });

  it('lists tours and filters by mode', () => {
    const daily = findEntities('GuidedTour', { filter: '{"mode":"daily"}', user: admin });
    const multiday = findEntities('GuidedTour', { filter: '{"mode":"multiday"}', user: admin });

    expect(daily.every((t) => t.mode === 'daily')).toBe(true);
    expect(multiday.every((t) => t.mode === 'multiday')).toBe(true);
    expect(daily.length).toBeGreaterThan(0);
    expect(multiday.length).toBeGreaterThan(0);
  });

  it('updates a tour', () => {
    const [tour] = findEntities('GuidedTour', { filter: '{"mode":"daily"}', user: admin });
    const updated = updateEntity('GuidedTour', tour.id, { name: 'Renamed Daily Tour', maxOccupancy: 20 }, admin);
    expect(updated.name).toBe('Renamed Daily Tour');
    expect(updated.maxOccupancy).toBe(20);
    // unaffected fields are preserved
    expect(updated.mode).toBe('daily');
  });

  it('deletes a tour', () => {
    const tour = createEntity('GuidedTour', { name: 'To Delete', mode: 'daily' }, admin);
    const before = findEntities('GuidedTour', { user: admin });
    deleteEntity('GuidedTour', tour.id, admin);
    const after = findEntities('GuidedTour', { user: admin });
    expect(after.length).toBe(before.length - 1);
  });

  describe('permission gating', () => {
    it('allows admins and managers to create/update/delete', () => {
      const created = createEntity('GuidedTour', { name: 'Mgr Tour', mode: 'daily' }, manager);
      expect(() => updateEntity('GuidedTour', created.id, { name: 'Mgr Tour 2' }, manager)).not.toThrow();
      expect(() => deleteEntity('GuidedTour', created.id, manager)).not.toThrow();
    });

    it('lets an agent with manage_guided_tours create and update', () => {
      const created = createEntity('GuidedTour', { name: 'Agent Tour', mode: 'daily' }, agentWithManage);
      createdIds.push(created.id);
      expect(() =>
        updateEntity('GuidedTour', created.id, { name: 'Agent Tour Updated' }, agentWithManage),
      ).not.toThrow();
    });

    it('blocks an agent without permissions from creating', () => {
      expect(() => createEntity('GuidedTour', { name: 'Nope', mode: 'daily' }, agentNoPerm)).toThrow(
        'Missing required permission',
      );
    });

    it('blocks an agent without permissions from updating an existing tour', () => {
      const [tour] = findEntities('GuidedTour', { filter: '{"mode":"daily"}', user: admin });
      expect(() => updateEntity('GuidedTour', tour.id, { name: 'Hacked' }, agentNoPerm)).toThrow();
    });

    it('grants read to admin/manager and agents holding view_guided_tours', () => {
      const [tour] = findEntities('GuidedTour', { user: admin });
      expect(userCanAccessEntity(admin, 'GuidedTour', tour)).toBe(true);
      expect(userCanAccessEntity(manager, 'GuidedTour', tour)).toBe(true);
      expect(userCanAccessEntity(agentWithView, 'GuidedTour', tour)).toBe(true);
    });

    it('denies read to an agent without the permission, except their own records', () => {
      const [tour] = findEntities('GuidedTour', { filter: '{"mode":"daily"}', user: admin });
      expect(userCanAccessEntity(agentNoPerm, 'GuidedTour', tour)).toBe(false);

      // Seed a record owned by the permissionless agent directly (it cannot
      // create one itself) to verify row-scoped read access to own records.
      const db = getDb();
      const now = new Date().toISOString();
      const ownId = `gt-owned-${Date.now()}`;
      db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
        ownId,
        'GuidedTour',
        JSON.stringify({ name: 'Owned', mode: 'daily', created_by: agentNoPerm.id }),
        now,
        now,
      );
      createdIds.push(ownId);
      const own = findEntities('GuidedTour', { user: admin }).find((t) => t.id === ownId);
      expect(userCanAccessEntity(agentNoPerm, 'GuidedTour', own)).toBe(true);
    });
  });
});
