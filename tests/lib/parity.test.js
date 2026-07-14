import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEntities } from '../../server/db.js';
import {
  PERMISSION_GROUPS as serverGroups,
  ALL_PERMISSION_KEYS as serverKeys,
  DEFAULT_TIER_PERMISSIONS as serverTiers,
} from '../../server/permissions.js';
import {
  PERMISSION_GROUPS as clientGroups,
  ALL_PERMISSION_KEYS as clientKeys,
  DEFAULT_TIER_PERMISSIONS as clientTiers,
} from '../../src/lib/permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The entity-type allowlist is no longer hand-synced: public/api-client.js
 * builds its `db.entities.<Type>` APIs through a Proxy that lazily creates an
 * API for any accessed name, so server/db.js's ENTITIES is the single source
 * of truth (the server rejects unknown types via assertKnownType). This test
 * now just guards against api-client.js reintroducing a hardcoded list that
 * could drift. The permission catalogs are likewise no longer hand-synced:
 * server/permissions.js and src/lib/permissions.js both re-export
 * shared/permissions.js, so these checks guard against someone reintroducing
 * a local fork. See ARCHITECTURE.md's "Permission model" section.
 */
describe('Registry parity', () => {
  it('api-client.js does not reintroduce a hardcoded ENTITIES list', () => {
    // The client resolves entity types dynamically via a Proxy; a reappearing
    // `var ENTITIES = [...]` would mean the hand-synced allowlist is back.
    const source = fs.readFileSync(path.join(__dirname, '../../public/api-client.js'), 'utf8');
    expect(source).not.toMatch(/var ENTITIES = \[/);
    // Sanity: the server still exposes a non-empty authoritative list.
    expect(getEntities().length).toBeGreaterThan(0);
  });

  it('permission key catalogs are identical on server and frontend', () => {
    expect([...serverKeys].sort()).toEqual([...clientKeys].sort());
  });

  it('permission group structure (keys per group) is identical', () => {
    const shape = (groups) => groups.map((g) => ({ key: g.key, permissions: g.permissions.map((p) => p.key) }));
    expect(shape(serverGroups)).toEqual(shape(clientGroups));
  });

  it('default tier permissions are identical on server and frontend', () => {
    expect(Object.keys(serverTiers).sort()).toEqual(Object.keys(clientTiers).sort());
    for (const tier of Object.keys(serverTiers)) {
      expect([...serverTiers[tier]].sort(), `tier: ${tier}`).toEqual([...clientTiers[tier]].sort());
    }
  });
});
