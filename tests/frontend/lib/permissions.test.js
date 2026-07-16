import { describe, it, expect } from 'vitest';
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, DEFAULT_TIER_PERMISSIONS, PERMISSION_MAP } from '@/lib/permissions';

describe('frontend permission catalog', () => {
  it('builds PERMISSION_MAP from PERMISSION_GROUPS', () => {
    const expected = {};
    for (const group of PERMISSION_GROUPS) {
      for (const perm of group.permissions) expected[perm.key] = perm;
    }
    expect(PERMISSION_MAP).toEqual(expected);
  });

  it('exposes every key listed in ALL_PERMISSION_KEYS', () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(PERMISSION_MAP[key]).toBeDefined();
    }
  });

  it('gives every tier a permissions array', () => {
    for (const tier of Object.keys(DEFAULT_TIER_PERMISSIONS)) {
      expect(Array.isArray(DEFAULT_TIER_PERMISSIONS[tier])).toBe(true);
    }
  });

  it('never maps the same key twice across groups', () => {
    const seen = new Set();
    for (const key of ALL_PERMISSION_KEYS) {
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
