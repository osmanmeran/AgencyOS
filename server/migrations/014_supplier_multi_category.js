// Suppliers previously belonged to a single category (`category_id`). A
// supplier can provide services across several categories (e.g. a company
// offering both transport and guiding), so this migration moves suppliers
// to a `category_ids` array, seeded from their existing single category.
export function up(db) {
  const now = new Date().toISOString();
  const updateEntity = db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?');

  const rows = db.prepare("SELECT id, data FROM entities WHERE type = 'Supplier'").all();
  for (const r of rows) {
    const data = JSON.parse(r.data);
    if (data.category_ids) continue;
    data.category_ids = data.category_id ? [data.category_id] : [];
    delete data.category_id;
    updateEntity.run(JSON.stringify(data), now, r.id);
  }
}

export function down(db) {
  const now = new Date().toISOString();
  const updateEntity = db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?');

  const rows = db.prepare("SELECT id, data FROM entities WHERE type = 'Supplier'").all();
  for (const r of rows) {
    const data = JSON.parse(r.data);
    if (!data.category_ids) continue;
    data.category_id = data.category_ids[0] || null;
    delete data.category_ids;
    updateEntity.run(JSON.stringify(data), now, r.id);
  }
}
