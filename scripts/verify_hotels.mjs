import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join('/app/data', 'marvelops.db');
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
const n = (sql) => db.prepare(sql).get().n;

const suppliers = n("SELECT COUNT(*) n FROM entities WHERE type='Supplier'");
const cats = n("SELECT COUNT(*) n FROM entities WHERE type='SupplierCategory'");
const subs = n("SELECT COUNT(*) n FROM entities WHERE type='SupplierSubcategory'");
const pricings = n("SELECT COUNT(*) n FROM entities WHERE type='SupplierPricing'");
const approved = n("SELECT COUNT(*) n FROM entities WHERE type='SupplierPricing' AND json_extract(data,'$.approval_status')='approved'");
const linked = n("SELECT COUNT(*) n FROM entities WHERE type='SupplierPricing' AND json_extract(data,'$.subcategory_id') IS NOT NULL");
const hotelsCat = db.prepare("SELECT id FROM entities WHERE type='SupplierCategory' AND json_extract(data,'$.name')='Hotels'").get();
const fts = n('SELECT COUNT(*) n FROM entities_fts');

// Resolve category_name for one sample pricing the same way b2b.js does.
const sample = db.prepare("SELECT data FROM entities WHERE type='SupplierPricing' LIMIT 1").get();
const p = JSON.parse(sample.data);
const subRow = db.prepare('SELECT data FROM entities WHERE id=?').get(p.subcategory_id);
const sub = subRow ? JSON.parse(subRow.data) : null;
const catRow = sub ? db.prepare('SELECT data FROM entities WHERE id=?').get(sub.category_id) : null;
const catName = catRow ? JSON.parse(catRow.data).name : null;

// Confirm a known hotel exists (MT AJWA HOTEL SULTANAHMET) with pricings.
const ajwa = db.prepare("SELECT id, data FROM entities WHERE type='Supplier' AND json_extract(data,'$.name')='MT AJWA HOTEL SULTANAHMET'").get();
const ajwaP = ajwa ? db.prepare("SELECT COUNT(*) n FROM entities WHERE type='SupplierPricing' AND json_extract(data,'$.supplier_id')=?").get(ajwa.id).n : 0;

// Hotel category names present (could be more than one).
const hotelCats = db
  .prepare("SELECT id, data FROM entities WHERE type='SupplierCategory'")
  .all()
  .map((r) => JSON.parse(r.data).name)
  .filter((nm) => (nm || '').toLowerCase().includes('hotel'));

// Resolve category_name for a NEW hotel's pricing (MT AJWA).
const ajwaSub = ajwa
  ? db.prepare("SELECT data FROM entities WHERE type='SupplierSubcategory' AND json_extract(data,'$.supplier_id')=? LIMIT 1").get(ajwa.id)
  : null;
const ajwaCatId = ajwaSub ? JSON.parse(ajwaSub.data).category_id : null;
const ajwaCatName = ajwaCatId ? JSON.parse(db.prepare('SELECT data FROM entities WHERE id=?').get(ajwaCatId).data).name : null;

console.log(JSON.stringify({
  suppliers, cats, subs, pricings, approved, linked,
  hotelsCategoryExists: !!hotelsCat,
  hotelCategoryNames: hotelCats,
  sampleCategoryName: catName,
  ajwaCategoryName: ajwaCatName,
  ftsRows: fts,
  ajwaHotelPricings: ajwaP,
}, null, 2));
