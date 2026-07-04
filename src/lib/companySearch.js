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
 * The key that identifies which company a contact belongs to. Prefers the real
 * `company_id` link; falls back to the normalized free-text company name for
 * contacts that predate / aren't linked to a Company record. Returns '' when
 * the contact has no company at all.
 */
export function companyKey(client) {
  if (client?.company_id) return `id:${client.company_id}`;
  const name = normalizeCompany(client?.company);
  return name ? `name:${name}` : '';
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
      const key = companyKey(c);
      if (key) matchedCompanies.add(key);
    }
  }

  const results = [];
  const colleagueIds = new Set();
  for (const c of clients) {
    const direct = directIds.has(c.id);
    const key = companyKey(c);
    const viaCompany = !direct && key && matchedCompanies.has(key);
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
  const key = companyKey(client);
  if (!key) return [];
  return allClients.filter(c => c.id !== client.id && companyKey(c) === key);
}

/** All contacts linked to a given Company id. */
export function contactsOfCompany(companyId, allClients) {
  if (!companyId) return [];
  return allClients.filter(c => c.company_id === companyId);
}
