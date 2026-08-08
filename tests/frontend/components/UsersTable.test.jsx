import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsersTable from '@/components/user-management/UsersTable';
import PendingUsersTable from '@/components/user-management/PendingUsersTable';
import en from '@/lib/i18n/locales/en.json';

// `useT` resolves a dotted key against the bundled English dictionary, so these
// specs assert on the real strings and would fail if a key were re-pointed at
// the wrong entry (the bug this file guards against).
vi.mock('@/lib/i18n/I18nContext', () => ({
  useT: () => ({
    t: (key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), en) ?? key,
    language: 'en',
  }),
}));

const currentUser = { id: 'u1', name: 'Ada Admin', email: 'ada@example.com', user_tier: 'admin', is_active: true };
const other = { id: 'u2', name: 'Bo Agent', email: 'bo@example.com', user_tier: 'agent', is_active: true };

function renderUsers() {
  return render(
    <UsersTable
      users={[currentUser, other]}
      currentUser={currentUser}
      allClients={[]}
      deptColor={() => ''}
      onEdit={() => {}}
      onDelete={() => {}}
    />,
  );
}

describe('UsersTable', () => {
  // The card wrapper clips with `overflow-hidden`; without an inner scroll
  // container the trailing columns (Status, Actions) are unreachable on a phone
  // rather than merely off-screen.
  it('puts the table in a horizontal scroll container', () => {
    const { container } = renderUsers();
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table.closest('.overflow-x-auto')).not.toBeNull();
  });

  it('labels the current user with the short "(you)" marker, not a page-level message', () => {
    renderUsers();
    expect(screen.getByText('(you)')).toBeInTheDocument();
    expect(screen.queryByText(/You need the Manage Users permission/i)).toBeNull();
  });

  it('uses short row-action labels rather than modal titles', () => {
    renderUsers();
    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Edit User:/i })).toBeNull();
  });
});

describe('PendingUsersTable', () => {
  it('puts the table in a horizontal scroll container', () => {
    const { container } = render(
      <PendingUsersTable
        users={[{ id: 'p1', name: 'Cy Pending', email: 'cy@example.com', is_active: false, created_date: null }]}
        onApprove={() => {}}
        onDeny={() => {}}
      />,
    );
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    expect(table.closest('.overflow-x-auto')).not.toBeNull();
  });
});
