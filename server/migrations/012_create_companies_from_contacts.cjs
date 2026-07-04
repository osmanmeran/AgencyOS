// Contacts (Client entities) previously stored their company as a free-text
// `company` string. We now have real Company records. This migration groups
// existing contacts by normalized company name, creates one Company per group,
// and links each contact via `company_id` (also normalizing the stored
// `company` name to the group's canonical casing so search/lists stay stable).
//
// Idempotent-ish: contacts that already have a company_id, and companies that
// already exist for a given name, are left untouched.
const crypto = require('crypto');

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

function normalize(name) {
  return (name || '').trim().toLowerCase();
}

module.exports.up = function (db) {
  const now = new Date().toISOString();

  const clients = db
    .prepare("SELECT id, data FROM entities WHERE type = 'Client'")
    .all()
    .map(r => ({ id: r.id, data: JSON.parse(r.data) }));

  // Existing companies, keyed by normalized name, so a re-run reuses them.
  const companiesByKey = new Map();
  for (const r of db.prepare("SELECT id, data FROM entities WHERE type = 'Company'").all()) {
    const data = JSON.parse(r.data);
    const key = normalize(data.name);
    if (key) companiesByKey.set(key, { id: r.id, data });
  }

  // Group contacts by normalized company name.
  const groups = new Map();
  for (const c of clients) {
    const key = normalize(c.data.company);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const insertCompany = db.prepare(
    'INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)'
  );
  const updateEntity = db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?');

  for (const [key, members] of groups.entries()) {
    let company = companiesByKey.get(key);

    if (!company) {
      // Canonical name: first non-empty original spelling in the group.
      const canonicalName = members
        .map(m => (m.data.company || '').trim())
        .find(Boolean) || members[0].data.company;

      // Seed shared billing / address fields from the first contact that has them.
      const seed = field => members.map(m => m.data[field]).find(v => v != null && v !== '');

      const data = {
        name: canonicalName,
        status: 'active',
        address: seed('address') || '',
        city: seed('city') || '',
        region: seed('region') || '',
        country: seed('country') || '',
        website: seed('website') || '',
        tax_id: seed('tax_id') || '',
        preferred_currency: seed('preferred_currency') || 'USD',
        created_by: 'migration',
      };
      const id = uid();
      insertCompany.run(id, 'Company', JSON.stringify(data), now, now);
      company = { id, data };
      companiesByKey.set(key, company);
    }

    // Link each contact to the company and normalize the stored name.
    for (const m of members) {
      if (m.data.company_id === company.id && m.data.company === company.data.name) continue;
      m.data.company_id = company.id;
      m.data.company = company.data.name;
      updateEntity.run(JSON.stringify(m.data), now, m.id);
    }
  }
};

module.exports.down = function (db) {
  // Unlink contacts, then remove companies created by this migration.
  const now = new Date().toISOString();
  const updateEntity = db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?');

  for (const r of db.prepare("SELECT id, data FROM entities WHERE type = 'Client'").all()) {
    const data = JSON.parse(r.data);
    if (data.company_id) {
      delete data.company_id;
      updateEntity.run(JSON.stringify(data), now, r.id);
    }
  }

  db.prepare(
    "DELETE FROM entities WHERE type = 'Company' AND json_extract(data, '$.created_by') = 'migration'"
  ).run();
};
