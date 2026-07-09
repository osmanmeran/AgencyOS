// Adds Cave Hotel and Boutique Hotel as new SupplierCategory entries
// if they don't already exist by name.

const CATEGORIES = [
  { name: 'Cave Hotel', description: 'Cave hotel accommodation', color: '#D97706' },
  { name: 'Boutique Hotel', description: 'Boutique hotel accommodation', color: '#EC4899' },
];

module.exports.up = function (db) {
  const now = new Date().toISOString();
  const existingNames = new Set(
    db
      .prepare("SELECT json_extract(data, '$.name') AS name FROM entities WHERE type = 'SupplierCategory'")
      .all()
      .map((r) => r.name),
  );

  const insert = db.prepare(
    'INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)',
  );
  const uid = () => require('crypto').randomBytes(8).toString('hex');

  for (const cat of CATEGORIES) {
    if (existingNames.has(cat.name)) {
      console.log(`[Migration] SupplierCategory "${cat.name}" already exists, skipping.`);
      continue;
    }
    const data = JSON.stringify({ name: cat.name, description: cat.description, color: cat.color });
    insert.run(uid(), 'SupplierCategory', data, now, now);
    console.log(`[Migration] Created SupplierCategory "${cat.name}".`);
  }
};

module.exports.down = function () {
  // Not reversible: would need to distinguish these seeded rows from user-created ones.
};