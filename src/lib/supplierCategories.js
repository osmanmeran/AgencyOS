// A supplier's categories are derived from the categories of its
// SupplierSubcategory service lines, not stored on the supplier itself —
// a supplier shows up under a category only once it has a subcategory in it.

export function categoryIdsBySupplier(subcategories) {
  const map = new Map();
  for (const sc of subcategories || []) {
    if (!sc.category_id) continue;
    if (!map.has(sc.supplier_id)) map.set(sc.supplier_id, new Set());
    map.get(sc.supplier_id).add(sc.category_id);
  }
  return map;
}

export function getSupplierCategoryIds(categoryMap, supplierId) {
  return [...(categoryMap.get(supplierId) || [])];
}

// Quick "add provider" flows (mid-proposal/reservation) used to set a
// category directly on the new supplier. Now that category comes from
// subcategories, creating a supplier "in" a category means seeding it with
// one default subcategory for that category so it shows up filtered right
// away — the user can rename/split it later in Pricing Management.
export async function createSupplierWithCategory(db, supplierData, categoryId, categoryName) {
  const supplier = await db.entities.Supplier.create(supplierData);
  if (categoryId) {
    await db.entities.SupplierSubcategory.create({
      supplier_id: supplier.id,
      category_id: categoryId,
      name: categoryName || 'General',
    });
  }
  return supplier;
}

export const GUIDED_TOURS_NAME = 'Guided Tours';

/** Finds a SupplierCategory by name (case-insensitive) or creates it. */
export async function ensureCategoryByName(db, name, color = '#8b5cf6') {
  const all = await db.entities.SupplierCategory.list();
  const existing = all.find((c) => c.name?.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  return db.entities.SupplierCategory.create({ name, description: '', icon: '', color });
}

/** Finds the supplier's subcategory for a category, creating the link if missing. */
export async function ensureSupplierSubcategory(db, supplierId, categoryId, name) {
  const subs = await db.entities.SupplierSubcategory.filter({ supplier_id: supplierId });
  const existing = subs.find((s) => s.category_id === categoryId);
  if (existing) return existing;
  return db.entities.SupplierSubcategory.create({
    supplier_id: supplierId,
    category_id: categoryId,
    name: name || 'General',
  });
}
