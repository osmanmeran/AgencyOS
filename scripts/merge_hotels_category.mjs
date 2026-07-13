import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');
const dry = process.argv.includes('--dry');
const db = new Database(DB_PATH, { readonly: dry, fileMustExist: true });
if (!dry) db.pragma('busy_timeout = 30000');
const now = () => new Date().toISOString();

const CANON = '5480d43c31573014'; // clean "Hotels"
const LEGACY = 'hsjiflkk';        // "Hotels " (trailing space)

const subQ = db.prepare("SELECT id, data FROM entities WHERE type='SupplierSubcategory' AND json_extract(data,'$.category_id')=?");
const legacySubs = subQ.all(LEGACY);
const canonSubsBefore = subQ.all(CANON).length;

// Defensive: suppliers whose data.categories array references the legacy id.
const supMatch = db.prepare("SELECT id, data FROM entities WHERE type='Supplier' AND json_extract(data,'$.categories') LIKE '%'||?||'%'").all(LEGACY);

if (dry) {
  console.log(JSON.stringify({ mode: 'DRY_RUN', legacySubcategories: legacySubs.length, canonicalSubcategoriesBefore: canonSubsBefore, suppliersReferencingLegacy: supMatch.length }, null, 2));
  db.close();
  process.exit(0);
}

const tx = db.transaction(() => {
  const upSub = db.prepare("UPDATE entities SET data = json_set(data, '$.category_id', ?), updated_date = ? WHERE id = ?");
  for (const s of legacySubs) upSub.run(CANON, now(), s.id);

  const upSup = db.prepare("UPDATE entities SET data = json_set(data, '$.categories', ?), updated_date = ? WHERE id = ?");
  for (const r of supMatch) {
    const arr = JSON.parse(r.data).categories || [];
    const fixed = [...new Set(arr.map((c) => (c === LEGACY ? CANON : c)))];
    upSup.run(JSON.stringify(fixed), now(), r.id);
  }

  // Delete the legacy category (FTS trigger removes its index row).
  db.prepare("DELETE FROM entities WHERE id = ? AND type='SupplierCategory'").run(LEGACY);
});
tx();

const canonSubsAfter = subQ.all(CANON).length;
const legacyExists = db.prepare("SELECT COUNT(*) c FROM entities WHERE id=?").get(LEGACY).c;
console.log(JSON.stringify({
  mode: 'APPLIED',
  legacySubcategoriesMoved: legacySubs.length,
  canonicalSubcategoriesBefore: canonSubsBefore,
  canonicalSubcategoriesAfter: canonSubsAfter,
  suppliersUpdated: supMatch.length,
  legacyCategoryRemaining: legacyExists,
}, null, 2));
db.close();
