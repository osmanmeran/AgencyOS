import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const db = new Database(path.join(DATA_DIR, 'marvelops.db'), { readonly: true });

const cats = db.prepare("SELECT data FROM entities WHERE type='SupplierCategory'")
  .all().map((r) => JSON.parse(r.data).name).filter((n) => /hotel/i.test(n));

const subsUnderHotels = db.prepare(
  "SELECT COUNT(*) c FROM entities WHERE type='SupplierSubcategory' AND json_extract(data,'$.category_id')=?"
).get('5480d43c31573014').c;

const subsUnderDeleted = db.prepare(
  "SELECT COUNT(*) c FROM entities WHERE type='SupplierSubcategory' AND json_extract(data,'$.category_id')=?"
).get('hsjiflkk').c;

const approved = db.prepare(
  "SELECT COUNT(*) c FROM entities WHERE type='SupplierPricing' AND json_extract(data,'$.approval_status')='approved'"
).get().c;

const legacyCatExists = db.prepare("SELECT COUNT(*) c FROM entities WHERE id=?").get('hsjiflkk').c;

console.log(JSON.stringify({
  hotelCategoriesLeft: cats,
  subcategoriesUnderHotels: subsUnderHotels,
  subcategoriesStillUnderDeleted: subsUnderDeleted,
  approvedPricings: approved,
  legacyCategoryStillExists: legacyCatExists,
}, null, 2));
