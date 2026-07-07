// Category ownership moves from the Supplier down to SupplierSubcategory: a
// supplier's categories are now derived from the categories of its service
// lines (e.g. MarvelTour shows up under Guided Tours and Transfers, but not
// Hotels, because that's where its subcategories actually are), instead of
// a hand-maintained list on the supplier itself.
//
// Backfill: each existing subcategory without a category_id is seeded with
// the first category from its supplier's (pre-migration 014) category_ids,
// as a starting guess to review. The now-unused category_ids field is
// dropped from Supplier records.
module.exports.up = function (db) {
  const now = new Date().toISOString();
  const updateEntity = db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?');

  const supplierRows = db.prepare("SELECT id, data FROM entities WHERE type = 'Supplier'").all();
  const supplierCategoryIds = new Map(
    supplierRows.map((r) => [r.id, JSON.parse(r.data).category_ids || []]),
  );

  const subcatRows = db.prepare("SELECT id, data FROM entities WHERE type = 'SupplierSubcategory'").all();
  for (const r of subcatRows) {
    const data = JSON.parse(r.data);
    if (data.category_id) continue;
    const fallback = (supplierCategoryIds.get(data.supplier_id) || [])[0];
    if (!fallback) continue;
    data.category_id = fallback;
    updateEntity.run(JSON.stringify(data), now, r.id);
  }

  for (const r of supplierRows) {
    const data = JSON.parse(r.data);
    if (!('category_ids' in data)) continue;
    delete data.category_ids;
    updateEntity.run(JSON.stringify(data), now, r.id);
  }
};

module.exports.down = function (db) {
  const now = new Date().toISOString();
  const updateEntity = db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?');

  const subcatRows = db.prepare("SELECT id, data FROM entities WHERE type = 'SupplierSubcategory'").all();
  const categoriesBySupplier = new Map();
  for (const r of subcatRows) {
    const data = JSON.parse(r.data);
    if (!data.category_id) continue;
    if (!categoriesBySupplier.has(data.supplier_id)) categoriesBySupplier.set(data.supplier_id, new Set());
    categoriesBySupplier.get(data.supplier_id).add(data.category_id);
  }

  const supplierRows = db.prepare("SELECT id, data FROM entities WHERE type = 'Supplier'").all();
  for (const r of supplierRows) {
    const data = JSON.parse(r.data);
    data.category_ids = [...(categoriesBySupplier.get(r.id) || [])];
    updateEntity.run(JSON.stringify(data), now, r.id);
  }

  for (const r of subcatRows) {
    const data = JSON.parse(r.data);
    if (!('category_id' in data)) continue;
    delete data.category_id;
    updateEntity.run(JSON.stringify(data), now, r.id);
  }
};
