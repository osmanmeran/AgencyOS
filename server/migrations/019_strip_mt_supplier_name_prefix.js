// A batch of hotel suppliers was imported from a rate sheet whose hotel-name
// column carried a stray "MT " source/supplier code prefix (e.g.
// "MT AJWA HOTEL SULTANAHMET", "MT WYNDHAM ISTANBUL OLD CITY"). The prefix is
// not part of the real hotel name, so strip a single leading "MT " from any
// Supplier whose name starts with it. Guarded to that exact pattern, so it's a
// no-op on fresh installs and dev, and idempotent (re-running strips nothing
// once the prefix is gone). The AFTER UPDATE trigger on `entities`
// (migration 009) keeps entities_fts in sync automatically.
const MT_PREFIX = /^MT\s+/;

export function up(db) {
  const now = new Date().toISOString();
  const rows = db.prepare("SELECT id, data FROM entities WHERE type = 'Supplier'").all();
  const update = db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?');

  const run = db.transaction((records) => {
    let fixed = 0;
    for (const row of records) {
      let data;
      try {
        data = JSON.parse(row.data);
      } catch {
        continue;
      }
      if (typeof data.name !== 'string' || !MT_PREFIX.test(data.name)) continue;
      data.name = data.name.replace(MT_PREFIX, '').trim();
      update.run(JSON.stringify(data), now, row.id);
      fixed += 1;
    }
    return fixed;
  });

  const fixed = run(rows);
  if (fixed > 0) console.log(`[Migration] Stripped "MT " prefix from ${fixed} supplier name(s).`);
}

export function down() {
  // Not reversible: the original "MT " prefix was a data-entry artifact, and
  // re-adding it to every stripped supplier would also (incorrectly) prefix any
  // supplier a user has since created starting with those words. Leave as-is.
}
