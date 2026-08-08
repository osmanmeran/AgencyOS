import { describe, it, expect, beforeEach } from 'vitest';
import {
  HOME_PAGE,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  homeTab,
  humanizePage,
  isHomeTab,
  loadTabs,
  makeTab,
  normalizeSearch,
  openTab,
  resolveTabLabels,
  saveTabs,
  tabIdentity,
  tabKey,
  tabLabel,
  withHome,
} from '@/lib/pageTabs';

const keys = (tabs) => tabs.map((tab) => tab.key);

describe('normalizeSearch', () => {
  it('keeps only the params that identify a record', () => {
    expect(normalizeSearch('?id=42&tab=notes&payment=ok')).toBe('?id=42');
    expect(normalizeSearch('?tripId=7')).toBe('?tripId=7');
    expect(normalizeSearch('?contract_id=9')).toBe('?contract_id=9');
  });

  it('drops pure view state so browsing one record stays one tab', () => {
    expect(normalizeSearch('?tab=notes')).toBe('');
    expect(normalizeSearch('')).toBe('');
    expect(normalizeSearch(undefined)).toBe('');
  });
});

describe('tabKey / makeTab', () => {
  it('builds a key from the page and its identity params', () => {
    expect(tabKey('Reservations', '')).toBe('/Reservations');
    expect(tabKey('ReservationDetails', '?id=5&tab=notes')).toBe('/ReservationDetails?id=5');
  });

  it('gives two records on the same page distinct keys', () => {
    expect(makeTab('ReservationDetails', '?id=5').key).not.toBe(makeTab('ReservationDetails', '?id=6').key);
  });
});

describe('humanizePage', () => {
  it('splits camel case', () => {
    expect(humanizePage('ReservationDetails')).toBe('Reservation Details');
  });

  it('keeps acronyms together', () => {
    expect(humanizePage('RFPManager')).toBe('RFP Manager');
  });
});

describe('tabLabel', () => {
  const t = (key) => (key === 'nav.dashboard' ? 'Panel' : key);

  it('prefers the translated nav label', () => {
    expect(tabLabel(homeTab(), t)).toBe('Panel');
  });

  it('falls back to a humanized page name when the key is missing', () => {
    // `t` echoes unknown keys back, which must not become the visible label.
    expect(tabLabel(makeTab('ReservationDetails', ''), t)).toBe('Reservation Details');
  });
});

describe('resolveTabLabels', () => {
  const t = (key) => (key === 'nav.dashboard' ? 'Dashboard' : key);

  it('leaves unambiguous labels alone', () => {
    const tabs = [homeTab(), makeTab('Suppliers', ''), makeTab('SupplierDetails', '?id=abc123')];
    expect([...resolveTabLabels(tabs, t).values()]).toEqual(['Dashboard', 'Suppliers', 'Supplier Details']);
  });

  it('appends the record id when two tabs would read the same', () => {
    const tabs = [homeTab(), makeTab('SupplierDetails', '?id=abc123'), makeTab('SupplierDetails', '?id=xyz789')];
    expect([...resolveTabLabels(tabs, t).values()]).toEqual([
      'Dashboard',
      'Supplier Details · abc123',
      'Supplier Details · xyz789',
    ]);
  });

  it('truncates long record ids', () => {
    const tabs = [makeTab('TripDetails', '?id=0123456789abcdef'), makeTab('TripDetails', '?id=fedcba9876543210')];
    expect([...resolveTabLabels(tabs, t).values()]).toEqual(['Trip Details · 012345', 'Trip Details · fedcba']);
  });
});

describe('tabIdentity', () => {
  it('reads whichever identity param the page uses', () => {
    expect(tabIdentity(makeTab('TripDetails', '?tripId=7'))).toBe('7');
    expect(tabIdentity(makeTab('Suppliers', ''))).toBe('');
  });
});

describe('openTab', () => {
  it('always keeps home first', () => {
    expect(keys(openTab([], makeTab('Suppliers', '')))).toEqual(['/Dashboard', '/Suppliers']);
  });

  it('is a no-op for a tab that is already open', () => {
    const tabs = openTab([], makeTab('Suppliers', ''));
    expect(keys(openTab(tabs, makeTab('Suppliers', '')))).toEqual(keys(tabs));
  });

  it('evicts the oldest closable tab past the cap, never home or the new tab', () => {
    let tabs = [homeTab()];
    for (let i = 0; i < 5; i++) tabs = openTab(tabs, makeTab(`Page${i}`, ''), 4);
    expect(keys(tabs)).toEqual(['/Dashboard', '/Page2', '/Page3', '/Page4']);
  });
});

describe('closeTab', () => {
  const tabs = [homeTab(), makeTab('Suppliers', ''), makeTab('Reservations', ''), makeTab('Revenue', '')];

  it('removes the tab and falls back to the one on its left', () => {
    const result = closeTab(tabs, '/Reservations');
    expect(keys(result.tabs)).toEqual(['/Dashboard', '/Suppliers', '/Revenue']);
    expect(result.fallbackKey).toBe('/Suppliers');
  });

  it('refuses to close home', () => {
    const result = closeTab(tabs, '/Dashboard');
    expect(keys(result.tabs)).toEqual(keys(tabs));
  });

  it('ignores a key that is not open', () => {
    expect(keys(closeTab(tabs, '/Nope').tabs)).toEqual(keys(tabs));
  });
});

describe('closeOtherTabs / closeAllTabs', () => {
  const tabs = [homeTab(), makeTab('Suppliers', ''), makeTab('Reservations', '')];

  it('keeps home and the tab being viewed', () => {
    expect(keys(closeOtherTabs(tabs, '/Reservations'))).toEqual(['/Dashboard', '/Reservations']);
  });

  it('collapses to home alone when home is the one being kept', () => {
    expect(keys(closeOtherTabs(tabs, '/Dashboard'))).toEqual(['/Dashboard']);
  });

  it('closes everything back to home', () => {
    expect(keys(closeAllTabs())).toEqual(['/Dashboard']);
  });
});

describe('withHome / isHomeTab', () => {
  it('treats a home page carrying a record id as an ordinary tab', () => {
    expect(isHomeTab(makeTab(HOME_PAGE, '?id=1'))).toBe(false);
    expect(isHomeTab(homeTab())).toBe(true);
  });

  it('never duplicates home', () => {
    expect(keys(withHome([homeTab(), homeTab(), makeTab('Suppliers', '')]))).toEqual(['/Dashboard', '/Suppliers']);
  });
});

describe('persistence', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('round-trips through session storage', () => {
    saveTabs([homeTab(), makeTab('ReservationDetails', '?id=5')]);
    expect(keys(loadTabs())).toEqual(['/Dashboard', '/ReservationDetails?id=5']);
  });

  it('falls back to home when nothing is stored', () => {
    expect(keys(loadTabs())).toEqual(['/Dashboard']);
  });

  it('survives corrupt storage', () => {
    window.sessionStorage.setItem('marvelops.pageTabs', '{not json');
    expect(keys(loadTabs())).toEqual(['/Dashboard']);
  });

  it('discards entries that are not tabs', () => {
    window.sessionStorage.setItem(
      'marvelops.pageTabs',
      JSON.stringify([null, { search: '?id=1' }, { page: 'Revenue' }]),
    );
    expect(keys(loadTabs())).toEqual(['/Dashboard', '/Revenue']);
  });
});
