import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PageTabs from '@/components/layout/PageTabs';

// The real dictionary is loaded async; a pass-through keeps assertions on the
// English strings without waiting for a locale chunk.
const EN = {
  'nav.dashboard': 'Dashboard',
  'nav.suppliers': 'Suppliers',
  'nav.reservations': 'Reservations',
  'pageTabs.label': 'Open pages',
  'pageTabs.actions': 'Tab actions',
  'pageTabs.closeCurrent': 'Close current tab',
  'pageTabs.closeOthers': 'Close other tabs',
  'pageTabs.closeAll': 'Close all tabs',
};

vi.mock('@/lib/i18n/I18nContext', () => ({
  useT: () => ({
    t: (key, params) => {
      if (key === 'pageTabs.close') return `Close ${params.label}`;
      return EN[key] ?? key;
    },
  }),
}));

/** Renders the strip for `path`, and echoes the current URL for assertions. */
function renderAt(path) {
  const pageOf = (pathname) => pathname.replace(/^\//, '') || 'Dashboard';

  function Harness() {
    const location = useLocation();
    return (
      <>
        <PageTabs currentPageName={pageOf(location.pathname)} />
        <div data-testid="url">{location.pathname + location.search}</div>
      </>
    );
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

const tabStrip = () => screen.getByRole('tablist', { name: 'Open pages' });
const tabNames = () =>
  within(tabStrip())
    .getAllByRole('tab')
    .map((el) => el.textContent);

beforeEach(() => window.sessionStorage.clear());

describe('PageTabs', () => {
  it('stays hidden until a second page is open', () => {
    renderAt('/Dashboard');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('opens a tab for the page you navigate to, behind a pinned home tab', async () => {
    renderAt('/Suppliers');
    expect(tabNames()).toEqual(['Dashboard', 'Suppliers']);
    expect(within(tabStrip()).getByRole('tab', { name: 'Suppliers' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not offer a close button on the home tab', () => {
    renderAt('/Suppliers');
    expect(screen.queryByRole('button', { name: 'Close Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close Suppliers' })).toBeInTheDocument();
  });

  it('navigates to the tab on its left when the active tab is closed', async () => {
    const user = userEvent.setup();
    renderAt('/Suppliers');
    await user.click(screen.getByRole('button', { name: 'Close Suppliers' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/Dashboard');
  });

  it('keeps the current page open when closing the others', async () => {
    const user = userEvent.setup();
    renderAt('/Suppliers');
    await user.click(within(tabStrip()).getByRole('tab', { name: 'Dashboard' }));
    // Navigating back to a page already open must not duplicate its tab.
    expect(tabNames()).toEqual(['Dashboard', 'Suppliers']);

    await user.click(screen.getByRole('button', { name: 'Tab actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Close other tabs' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('/Dashboard');
  });

  it('restores the open tabs from session storage', () => {
    window.sessionStorage.setItem(
      'marvelops.pageTabs',
      JSON.stringify([
        { page: 'Dashboard', search: '' },
        { page: 'Reservations', search: '' },
      ]),
    );
    renderAt('/Dashboard');
    expect(tabNames()).toEqual(['Dashboard', 'Reservations']);
  });

  it('gives two records on the same page their own tabs', () => {
    window.sessionStorage.setItem(
      'marvelops.pageTabs',
      JSON.stringify([{ page: 'ReservationDetails', search: '?id=5' }]),
    );
    renderAt('/ReservationDetails?id=6');
    // Same page twice, so the labels carry the record id to stay tellable apart.
    expect(tabNames()).toEqual(['Dashboard', 'Reservation Details · 5', 'Reservation Details · 6']);
    expect(screen.getByTestId('url')).toHaveTextContent('/ReservationDetails?id=6');
  });
});
