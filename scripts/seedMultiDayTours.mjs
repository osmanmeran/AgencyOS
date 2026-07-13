// Seed the two private multi-day Turkey tours (MERAVIGLIA / WONDER TOUR and
// GRAND TOUR) as GuidedTour entities with mode 'multiday', in both Italian
// ('it') and English ('en') language variants, linked to the "Marvel tour"
// supplier. Data lives in the sibling multiDayTours.seed.json (generated from
// the "Tour Turchia privati" document).
//
// Idempotent: re-running skips records whose name already exists.
//
// Run with: node scripts/seedMultiDayTours.mjs
import { createEntity } from '../server/services/entities.js';
import { getDb } from '../server/db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const admin = { user_tier: 'admin', id: 'seed-multiday-tours', custom_permissions: [] };

const records = JSON.parse(
  readFileSync(path.join(__dirname, 'multiDayTours.seed.json'), 'utf-8')
);

function findSupplierId(db) {
  const row = db
    .prepare("SELECT id FROM entities WHERE type='Supplier' AND lower(json_extract(data,'$.name')) LIKE ?")
    .get('%marvel%');
  if (row) return row.id;
  const sup = createEntity('Supplier', { name: 'Marvel tour' }, admin);
  return sup.id;
}

function alreadyExists(db, name) {
  const row = db
    .prepare("SELECT id FROM entities WHERE type='GuidedTour' AND json_extract(data,'$.name')=?")
    .get(name);
  return !!row;
}

const db = getDb();
const supplierId = findSupplierId(db);
const supplierName = 'Marvel tour';

let created = 0;
for (const t of records) {
  if (alreadyExists(db, t.name)) {
    console.log(`skip (exists): ${t.name}`);
    continue;
  }
  const payload = {
    ...t,
    supplierId,
    supplierName,
  };
  const createdTour = createEntity('GuidedTour', payload, admin);
  console.log(`created: ${createdTour.name} (${createdTour.id}) [${t.language}]`);
  created += 1;
}

console.log(`\nDone. Created ${created} new multi-day tours linked to supplier "${supplierName}" (id: ${supplierId}).`);
