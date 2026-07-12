import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '../../server/db.js';
import { getUserPermissions, hasPermission, getEffectiveTierPermissions } from '../../server/permissions.js';

// hasPermission/getUserPermissions consult the live AppSettings.tier_permissions
// override an admin can save via the Permissions tab (AppSettings.jsx /
// UserManagement.jsx), UNIONED with the hardcoded DEFAULT_TIER_PERMISSIONS.
// The union (rather than wholesale replacement) means a stale override saved
// before a permission key was introduced in code can never silently strip that
// new capability from a tier. These tests cover that the server honors the
// override and inherits defaults when there isn't one.

const db = getDb();

function setAppSettings(data) {
  db.prepare(`DELETE FROM entities WHERE type = 'AppSettings'`).run();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    'app-settings-permissions-test',
    'AppSettings',
    JSON.stringify(data),
    now,
    now,
  );
}

function clearAppSettings() {
  db.prepare(`DELETE FROM entities WHERE type = 'AppSettings'`).run();
}

describe('server permissions: AppSettings.tier_permissions override', () => {
  afterEach(() => clearAppSettings());

  it('falls back to DEFAULT_TIER_PERMISSIONS when no AppSettings row exists', () => {
    clearAppSettings();
    expect(hasPermission('agent', [], 'create_trips')).toBe(true);
    expect(hasPermission('agent', [], 'delete_trips')).toBe(false);
  });

  it('falls back to defaults when AppSettings exists but has no tier_permissions field', () => {
    setAppSettings({ app_name: 'Test Agency' });
    expect(hasPermission('agent', [], 'create_trips')).toBe(true);
  });

  it('honors a live override that grants an extra permission to a tier', () => {
    setAppSettings({ tier_permissions: { agent: ['create_trips', 'delete_trips'] } });
    expect(hasPermission('agent', [], 'delete_trips')).toBe(true);
  });

  it('never lets an override silently revoke a default permission (defaults are always inherited)', () => {
    // A stale/partial override (e.g. saved before a new key was introduced)
    // must not strip capabilities the tier gets from defaults.
    setAppSettings({ tier_permissions: { agent: [] } });
    expect(hasPermission('agent', [], 'create_trips')).toBe(true);
  });

  it('falls back to defaults for a tier missing from the override object', () => {
    setAppSettings({ tier_permissions: { agent: [] } });
    // manager isn't in the override at all, so it keeps its hardcoded defaults
    expect(hasPermission('manager', [], 'create_trips')).toBe(true);
  });

  it('still merges in custom_permissions on top of the effective tier grants', () => {
    setAppSettings({ tier_permissions: { agent: [] } });
    expect(hasPermission('agent', ['create_trips'], 'create_trips')).toBe(true);
  });

  it('getUserPermissions and getEffectiveTierPermissions agree with hasPermission', () => {
    setAppSettings({ tier_permissions: { agent: ['create_trips'] } });
    // effective perms = defaults unioned with the override
    const effective = getEffectiveTierPermissions('agent');
    expect(effective).toEqual(expect.arrayContaining(['create_trips']));
    expect(getUserPermissions('agent', ['view_reports'])).toEqual(
      expect.arrayContaining(['create_trips', 'view_reports']),
    );
  });
});
