import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');
const dry = process.argv.includes('--dry');
const db = new Database(DB_PATH, { readonly: dry, fileMustExist: true });
if (!dry) db.pragma('busy_timeout = 30000');
const now = () => new Date().toISOString();

const HOTELS = '5480d43c31573014';
const DELETE_IDS = ['34d629fcc6ac3a0a', '7dea630f684308f9']; // MT ARTS HOTEL TAKSIM, MT WYNDHAM ISTANBUL OLD CITY

// Verified-stable Unsplash hotel/room images (the app already uses Unsplash).
const IMGS = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517840901100-8179e982acb7?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop',
];

// All hotel suppliers (via their Hotels-category subcategories).
const subs = db
  .prepare("SELECT id, data FROM entities WHERE type='SupplierSubcategory' AND json_extract(data,'$.category_id')=?")
  .all(HOTELS);
const hotelSupIds = [...new Set(subs.map((s) => JSON.parse(s.data).supplier_id).filter(Boolean))]
  .filter((id) => !DELETE_IDS.includes(id));
hotelSupIds.sort();

const pricingRows = db.prepare("SELECT id, data FROM entities WHERE type='SupplierPricing'").all();
const pricingBySupplier = new Map();
for (const r of pricingRows) {
  const p = JSON.parse(r.data);
  if (p.supplier_id) {
    if (!pricingBySupplier.has(p.supplier_id)) pricingBySupplier.set(p.supplier_id, []);
    pricingBySupplier.get(p.supplier_id).push(r.id);
  }
}

const imgFor = (i) => IMGS[i % IMGS.length];

let photosSet = 0;
let pricingsUpdated = 0;
let suppliersDeleted = 0;
let subsDeleted = 0;
let pricingsDeleted = 0;

if (dry) {
  console.log(JSON.stringify({
    mode: 'DRY_RUN',
    hotelSuppliers: hotelSupIds.length,
    toDelete: DELETE_IDS,
    pricingsUnderHotels: [...pricingBySupplier.values()].reduce((a, b) => a + b.length, 0),
  }, null, 2));
  db.close();
  process.exit(0);
}

const tx = db.transaction(() => {
  const upSup = db.prepare("UPDATE entities SET data = json_set(data, '$.image_url', ?, '$.photos', json_array(?), '$.has_photo', 1), updated_date = ? WHERE id = ?");
  const upPrice = db.prepare("UPDATE entities SET data = json_set(data, '$.image_url', ?), updated_date = ? WHERE id = ?");

  hotelSupIds.forEach((id, i) => {
    const url = imgFor(i);
    upSup.run(url, url, now(), id);
    photosSet++;
    const pIds = pricingBySupplier.get(id) || [];
    for (const pid of pIds) { upPrice.run(url, now(), pid); pricingsUpdated++; }
  });

  const delPrice = db.prepare("DELETE FROM entities WHERE type='SupplierPricing' AND json_extract(data,'$.subcategory_id')=?");
  const delSub = db.prepare("DELETE FROM entities WHERE type='SupplierSubcategory' AND json_extract(data,'$.supplier_id')=?");
  const delSup = db.prepare("DELETE FROM entities WHERE id=? AND type='Supplier'");
  for (const id of DELETE_IDS) {
    const s = db.prepare("SELECT id, data FROM entities WHERE type='SupplierSubcategory' AND json_extract(data,'$.supplier_id')=?").all(id);
    for (const sub of s) {
      delPrice.run(sub.id);
      pricingsDeleted++;
    }
    const n = delSub.run(id).changes;
    subsDeleted += n;
    suppliersDeleted += delSup.run(id).changes;
  }
});
tx();

console.log(JSON.stringify({
  mode: 'APPLIED',
  suppliersWithPhoto: photosSet,
  pricingsUpdated,
  suppliersDeleted,
  subcategoriesDeleted: subsDeleted,
  pricingsDeleted,
}, null, 2));
db.close();
