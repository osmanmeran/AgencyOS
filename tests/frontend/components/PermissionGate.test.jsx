import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionProvider } from '@/components/permissions/PermissionContext';
import PermissionGate from '@/components/permissions/PermissionGate';
import { DEFAULT_TIER_PERMISSIONS, ALL_PERMISSION_KEYS } from '@/lib/permissions';
import { db } from '@/lib/DbContext';

vi.mock('@/lib/DbContext', () => ({
  db: {
    auth: { me: vi.fn() },
    entities: { AppSettings: { list: vi.fn() } },
  },
}));

const TIER = 'agent';
const base = DEFAULT_TIER_PERMISSIONS[TIER];
const inTier = base[0];
const notInTier = ALL_PERMISSION_KEYS.find((k) => !base.includes(k));

beforeEach(() => {
  db.auth.me.mockReset();
  db.entities.AppSettings.list.mockReset();
  db.auth.me.mockResolvedValue({ user_tier: TIER, custom_permissions: [] });
  db.entities.AppSettings.list.mockResolvedValue([]);
});

describe('PermissionGate (permission-gated UI)', () => {
  it('renders children when the user holds the required permission', async () => {
    render(
      <PermissionProvider>
        <PermissionGate permission={inTier}>
          <div>allowed</div>
        </PermissionGate>
      </PermissionProvider>,
    );
    expect(await screen.findByText('allowed')).toBeInTheDocument();
  });

  it('renders the fallback when the user lacks the permission', async () => {
    render(
      <PermissionProvider>
        <PermissionGate permission={notInTier} fallback={<div>denied</div>}>
          <div>allowed</div>
        </PermissionGate>
      </PermissionProvider>,
    );
    expect(await screen.findByText('denied')).toBeInTheDocument();
    expect(screen.queryByText('allowed')).not.toBeInTheDocument();
  });

  it('honors custom_permissions granted to the user', async () => {
    db.auth.me.mockResolvedValue({ user_tier: TIER, custom_permissions: [notInTier] });
    render(
      <PermissionProvider>
        <PermissionGate permission={notInTier} fallback={<div>denied</div>}>
          <div>allowed</div>
        </PermissionGate>
      </PermissionProvider>,
    );
    expect(await screen.findByText('allowed')).toBeInTheDocument();
  });
});
