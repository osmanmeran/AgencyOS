import { describe, it, expect } from 'vitest';
import { getEntities } from '../../server/db.js';
import { CLIENT_SCOPED_TYPES, USER_SCOPED_TYPES } from '../../server/services/entities.js';

/**
 * Item #7 follow-up: the client side no longer keeps an entity-type list —
 * public/api-client.js resolves `db.entities.<Type>` through a Proxy, so
 * server/db.js's ENTITIES is the single source of truth (see
 * tests/lib/parity.test.js). The only remaining hand-synced pair is the
 * server-internal ENTITIES vs the scoping constants below. These checks catch
 * drift: a type referenced by a scoping list must be a registered entity, and
 * the allowlists must not contain duplicates.
 */
describe('Entity registry parity', () => {
  const entities = getEntities();

  it('server ENTITIES is the non-empty authoritative list', () => {
    expect(entities.length).toBeGreaterThan(0);
  });

  it('CLIENT_SCOPED_TYPES only references registered entity types', () => {
    for (const type of CLIENT_SCOPED_TYPES) {
      expect(entities, `CLIENT_SCOPED_TYPES references unknown type: ${type}`).toContain(type);
    }
  });

  it('USER_SCOPED_TYPES only references registered entity types', () => {
    for (const type of USER_SCOPED_TYPES) {
      expect(entities, `USER_SCOPED_TYPES references unknown type: ${type}`).toContain(type);
    }
  });

  it('scoping lists contain no duplicates', () => {
    const dup = (arr) => arr.filter((v, i) => arr.indexOf(v) !== i);
    expect(dup(CLIENT_SCOPED_TYPES)).toEqual([]);
    expect(dup(USER_SCOPED_TYPES)).toEqual([]);
  });
});
