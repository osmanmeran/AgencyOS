// OBSOLETE — Cave Hotel and Boutique Hotel are no longer separate
// SupplierCategory entries. They are now hotel type/rating options
// (alongside 3-, 4-, 5-star) defined in src/lib/hotelTypes.js.
// This migration is intentionally a no-op to avoid conflicting with
// the down migration sequence.

const CATEGORIES = [
  { name: 'Cave Hotel', description: 'Cave hotel accommodation', color: '#D97706' },
  { name: 'Boutique Hotel', description: 'Boutique hotel accommodation', color: '#EC4899' },
];

module.exports.up = function (db) {
  // Check if these categories exist and warn the user to remove them manually
  const existing = db
    .prepare("SELECT id, data FROM entities WHERE type = 'SupplierCategory' AND (json_extract(data, '$.name') = 'Cave Hotel' OR json_extract(data, '$.name') = 'Boutique Hotel')")
    .all();
  if (existing.length > 0) {
    console.log(`[Migration] Found ${existing.length} obsolete category/ies (Cave Hotel / Boutique Hotel).`);
    console.log('[Migration] These should now be handled as hotel type options instead of categories.');
    console.log('[Migration] Auto-removing them...');
    const del = db.prepare("DELETE FROM entities WHERE id = ?");
    for (const row of existing) {
      del.run(row.id);
      console.log(`[Migration] Deleted obsolete SupplierCategory "${JSON.parse(row.data).name}" (${row.id}).`);
    }
  } else {
    console.log('[Migration] No obsolete Cave Hotel / Boutique Hotel categories found.');
  }
};

module.exports.down = function () {
  // Re-create the categories if rolling back
  const now = new Date().toISOString();
  const insert = db.prepare(
    'INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)',
  );
  const uid = () => require('crypto').randomBytes(8).toString('hex');
  for (const cat of CATEGORIES) {
    const data = JSON.stringify({ name: cat.name, description: cat.description, color: cat.color });
    insert.run(uid(), 'SupplierCategory', data, now, now);
    console.log(`[Migration] Re-created SupplierCategory "${cat.name}".`);
  }
};