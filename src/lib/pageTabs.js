/**
 * Page-tab bookkeeping for the staff shell (see components/layout/PageTabs.jsx).
 *
 * The open-tab list is the only state kept here — which tab is *active* is
 * always derived from the router location, so the two can never drift apart.
 * Everything in this module is pure apart from the two storage helpers.
 */

import { createPageUrl } from '@/utils';

/** Always-present, never-closable first tab. */
export const HOME_PAGE = 'Dashboard';

/** Beyond this, opening a tab evicts the oldest closable one. */
export const MAX_TABS = 12;

const STORAGE_KEY = 'marvelops.pageTabs';

/**
 * Query params that identify *which record* a page is showing. Anything else
 * (`?tab=notes`, `?payment=ok`, `?fromQuote=…`) is view state, and is dropped
 * from the tab key so that poking around inside one reservation doesn't
 * spawn a new tab per click.
 */
const IDENTITY_PARAMS = ['id', 'tripId', 'contract_id'];

/** Pages whose tab label should follow the translated sidebar label. */
const PAGE_LABEL_KEYS = {
  Dashboard: 'nav.dashboard',
  Reservations: 'nav.reservations',
  CreateReservation: 'nav.newReservation',
  Suppliers: 'nav.suppliers',
  SupplierBookings: 'nav.bookings',
  ClientCRM: 'nav.crm',
  Revenue: 'nav.revenue',
  BookingTemplates: 'nav.templates',
  ItineraryBuilder: 'nav.itineraryBuilder',
  DailyTours: 'nav.dailyTours',
  MultiDayTours: 'nav.multiDayTours',
  AppSettings: 'nav.settings',
  ImportHub: 'nav.importHub',
  CreateProposal: 'nav.newProposal',
};

/** Strip view-state params, keeping only what identifies the record. */
export function normalizeSearch(search) {
  if (!search) return '';
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const name of IDENTITY_PARAMS) {
    const value = params.get(name);
    if (value) kept.set(name, value);
  }
  const str = kept.toString();
  return str ? `?${str}` : '';
}

/** Stable identity of a tab — also the URL its label links to. */
export function tabKey(page, search) {
  return createPageUrl(page) + normalizeSearch(search);
}

export function makeTab(page, search) {
  const normalized = normalizeSearch(search);
  return { key: createPageUrl(page) + normalized, page, search: normalized };
}

export const homeTab = () => makeTab(HOME_PAGE, '');

/** `ReservationDetails` -> `Reservation Details`, `RFPManager` -> `RFP Manager`. */
export function humanizePage(page) {
  return String(page || '')
    .replace(/[-_]/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

/**
 * Label for a tab. Resolved at render time rather than stored, so switching
 * language relabels tabs that are already open.
 */
export function tabLabel(tab, t) {
  const key = PAGE_LABEL_KEYS[tab.page];
  if (key) {
    const translated = t(key);
    // `t` echoes the key back when it's missing from every dictionary.
    if (translated && translated !== key) return translated;
  }
  return humanizePage(tab.page);
}

/** The record id a tab is pinned to, if any — used to tell two of the same page apart. */
export function tabIdentity(tab) {
  if (!tab.search) return '';
  const params = new URLSearchParams(tab.search);
  for (const name of IDENTITY_PARAMS) {
    const value = params.get(name);
    if (value) return value;
  }
  return '';
}

/**
 * Labels for the whole strip at once, because disambiguation needs the set:
 * two records open on the same page would otherwise both read
 * "Supplier Details", so those get their record id appended.
 */
export function resolveTabLabels(tabs, t) {
  const list = tabs || [];
  const counts = new Map();
  for (const tab of list) {
    const label = tabLabel(tab, t);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return new Map(
    list.map((tab) => {
      const label = tabLabel(tab, t);
      const identity = counts.get(label) > 1 ? tabIdentity(tab) : '';
      return [tab.key, identity ? `${label} · ${identity.slice(0, 6)}` : label];
    }),
  );
}

export function isHomeTab(tab) {
  return tab.page === HOME_PAGE && !tab.search;
}

/** Home is always present and always first. */
export function withHome(tabs) {
  const rest = (tabs || []).filter((tab) => !isHomeTab(tab));
  return [homeTab(), ...rest];
}

/**
 * Open `tab`, or no-op if it's already open. Over MAX_TABS the oldest closable
 * tab is evicted; the tab being opened is newest so it's never the victim.
 */
export function openTab(tabs, tab, max = MAX_TABS) {
  const list = withHome(tabs);
  if (list.some((existing) => existing.key === tab.key)) return list;
  const next = [...list, tab];
  return next.length > max ? [next[0], ...next.slice(2)] : next;
}

/**
 * Close one tab. `fallbackKey` is where to navigate if the closed tab was the
 * active one — the tab to its left, matching every other tabbed editor.
 */
export function closeTab(tabs, key) {
  const list = withHome(tabs);
  const index = list.findIndex((tab) => tab.key === key);
  if (index <= 0) return { tabs: list, fallbackKey: list[0].key };
  return { tabs: list.filter((tab) => tab.key !== key), fallbackKey: list[index - 1].key };
}

/** Close everything except home and `keepKey`. */
export function closeOtherTabs(tabs, keepKey) {
  const list = withHome(tabs);
  const kept = list.find((tab) => tab.key === keepKey);
  return kept && !isHomeTab(kept) ? [list[0], kept] : [list[0]];
}

export function closeAllTabs() {
  return [homeTab()];
}

/**
 * Tabs are per browser tab and per session: reopening the app in a new tab
 * shouldn't inherit whatever was left open somewhere else.
 */
export function loadTabs() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [homeTab()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [homeTab()];
    const restored = parsed
      .filter((tab) => tab && typeof tab.page === 'string')
      .map((tab) => makeTab(tab.page, tab.search));
    return withHome(restored).slice(0, MAX_TABS);
  } catch {
    return [homeTab()];
  }
}

export function saveTabs(tabs) {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify((tabs || []).map(({ page, search }) => ({ page, search }))),
    );
  } catch {
    // Private-mode / quota failures are not worth breaking navigation over.
  }
}
