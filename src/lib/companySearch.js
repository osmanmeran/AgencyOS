/**
 * Company-aware contact search.
 *
 * A contact belongs to a company via its free-text `company` field. When a
 * search matches a company — either by the company name itself, or by any
 * single contact at that company — we surface *every* contact in that company,
 * not just the one that literally matched. This makes "search for a company,
 * see the whole team" work, and also reveals a person's colleagues when you
 * search them by name/email.
 */

/** Normalize a company name for grouping (case/space-insensitive). */
export function normalizeCompany(company) {
  return (company || '').trim().toLowerCase();
}

/**
 * Filter contacts by a query with company-aware expansion.
 *
 * @param {Array<any>} clients
 * @param {string} query
 * @returns {{ results: Array<any>, colleagueIds: Set<string>, matchedCompanies: Set<string> }}
 *   `results` preserves the input order. `colleagueIds` are contacts included
 *   only because a company they belong to matched (not a direct field match) —
 *   useful for badging them in the UI. `matchedCompanies` are the normalized
 *   company names that matched.
 */
export function filterClientsByCompany(clients, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return { results: clients, colleagueIds: new Set(), matchedCompanies: new Set() };
  }

  const directIds = new Set();
  const matchedCompanies = new Set();

  for (const c of clients) {
    const matches =
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q);
    if (matches) {
      directIds.add(c.id);
      const company = normalizeCompany(c.company);
      if (company) matchedCompanies.add(company);
    }
  }

  const results = [];
  const colleagueIds = new Set();
  for (const c of clients) {
    const direct = directIds.has(c.id);
    const company = normalizeCompany(c.company);
    const viaCompany = !direct && company && matchedCompanies.has(company);
    if (direct || viaCompany) {
      results.push(c);
      if (viaCompany) colleagueIds.add(c.id);
    }
  }

  return { results, colleagueIds, matchedCompanies };
}

/**
 * Other contacts sharing the same company as `client` (excludes the client
 * itself, and contacts without a company).
 */
export function colleaguesOf(client, allClients) {
  const company = normalizeCompany(client?.company);
  if (!company) return [];
  return allClients.filter(
    c => c.id !== client.id && normalizeCompany(c.company) === company
  );
}
