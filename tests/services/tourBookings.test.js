import { describe, it, expect, afterAll } from 'vitest';
import {
  assertValidEntityType,
  createEntity,
  updateEntity,
  deleteEntity,
  findEntities,
} from '../../server/services/entities.js';

const admin = { user_tier: 'admin', id: 'test-admin-tb', custom_permissions: [] };
const agentNoPerm = { user_tier: 'agent', id: 'test-agent-no-tb', custom_permissions: [] };

const created = [];

describe('TourBooking entity', () => {
  afterAll(() => {
    for (const id of created) {
      try {
        deleteEntity('TourBooking', id, admin);
      } catch {
        /* gone */
      }
    }
  });

  it('is a registered entity type', () => {
    expect(() => assertValidEntityType('TourBooking')).not.toThrow();
  });

  it('creates a booking linked to a tour and departure', () => {
    const booking = createEntity(
      'TourBooking',
      {
        tourId: 'tour-1',
        tourName: 'Cappadocia Explorer',
        mode: 'multiday',
        departureDate: '2026-08-01',
        participants: 4,
        customerName: 'Jane Doe',
        status: 'confirmed',
      },
      admin,
    );
    created.push(booking.id);

    expect(booking.id).toBeTruthy();
    expect(booking.tourId).toBe('tour-1');
    expect(booking.participants).toBe(4);
    expect(booking.created_by).toBe(admin.id);
  });

  it('lists bookings and filters by tourId', () => {
    const forTour = findEntities('TourBooking', { filter: '{"tourId":"tour-1"}', user: admin });
    expect(forTour.length).toBeGreaterThan(0);
    expect(forTour.every((b) => b.tourId === 'tour-1')).toBe(true);
  });

  it('updates a booking status', () => {
    const [b] = findEntities('TourBooking', { filter: '{"tourId":"tour-1"}', user: admin });
    const updated = updateEntity('TourBooking', b.id, { status: 'cancelled' }, admin);
    expect(updated.status).toBe('cancelled');
  });

  it('blocks an agent without manage_guided_tours from creating', () => {
    expect(() => createEntity('TourBooking', { tourId: 'tour-1', participants: 2 }, agentNoPerm)).toThrow(
      'Missing required permission',
    );
  });

  it('deletes a booking', () => {
    const b = createEntity('TourBooking', { tourId: 'tour-del', participants: 1 }, admin);
    const before = findEntities('TourBooking', { user: admin }).length;
    deleteEntity('TourBooking', b.id, admin);
    const after = findEntities('TourBooking', { user: admin }).length;
    expect(after).toBe(before - 1);
  });
});
