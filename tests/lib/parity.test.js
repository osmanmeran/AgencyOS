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
 * These parity tests guard the two pairs of hand-synced registries the
 * architecture depends on (see ARCHITECTURE.md): the entity-type allowlists
 * in server/db.js and public/api-client.js, and the permission catalogs in
 * server/permissions.js and src/lib/permissions.js. If one of these fails,
 * update BOTH sides of the pair, not the test.
 */
describe('Registry parity', () => {
  it('server ENTITIES matches the api-client ENTITIES list', () => {
    // public/api-client.js is a plain browser <script>, not an importable
    // module — extract its ENTITIES array from the source text.
    const source = fs.readFileSync(path.join(__dirname, '../../public/api-client.js'), 'utf8');
    const match = source.match(/var ENTITIES = \[([^\]]*)\]/);
    expect(match).toBeTruthy();
    const clientEntities = match[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);

    expect([...clientEntities].sort()).toEqual([...getEntities()].sort());
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
