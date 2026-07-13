import openpyxl, json, subprocess, tempfile, os, base64

wb = openpyxl.load_workbook("/Users/osmanmeran/Documenti computer/deneme.xlsx", data_only=True)
ws = wb["deneme"]
rows = list(ws.iter_rows(values_only=True))[1:]  # drop header

CITY = {
    "IST": "Istanbul", "AYT": "Antalya", "DLM": "Dalaman",
    "PAM": "Pamukkale", "CAN": "Canakkale", "DNZ": "Denizli",
}
OCC = {
    "DOUBLE ROOM": "double", "SINGLE ROOM": "single",
    "TRIPLE ROOM": "triple", "TRIPLE": "triple",
}
MEAL = {
    "BED AND BREAKFAST": "BB", "ROOM ONLY": "RO",
    "HALF BOARD": "HB", "FULL BOARD": "FB",
    "ALL INCLUSIVE": "AI", "ULTRA ALL INCLUSIVE": "UAI",
}

def pdate(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        from datetime import datetime
        return datetime.strptime(s, "%d/%m/%Y").strftime("%Y-%m-%d")
    except Exception:
        return None

def num(v):
    try:
        return float(v)
    except Exception:
        return None

records = []
for r in rows:
    if not r or not r[0]:
        continue
    hotel = str(r[0]).strip()
    room = (r[8] or "").strip()
    room_type = (r[9] or "").strip()
    board = (r[10] or "").strip()
    sell = num(r[16]); buy = num(r[11])
    if not room or not board or sell is None:
        continue
    occ = OCC.get(room.upper(), room.lower().replace(" ", "_")[:12])
    meal = MEAL.get(board.upper())
    if meal is None:
        meal = board.upper().replace(" ", "_")[:8]
    start = pdate(r[5]); end = pdate(r[6])
    if not start or not end:
        continue
    sell_cur = (r[17] or r[12] or "EUR")
    region = (r[24] or "").strip()
    records.append({
        "hotel": hotel,
        "star": (str(r[1]).strip() if r[1] else ""),
        "operator": (str(r[2]).strip() if r[2] else ""),
        "room": room,
        "room_type": room_type or f"{room} ({board})",
        "board": board,
        "buy": buy if buy is not None else sell,
        "sell": sell,
        "cur": sell_cur,
        "occ": occ,
        "meal": meal,
        "start": start,
        "end": end,
        "region": region,
        "city": CITY.get(region, region),
    })

data_json = json.dumps(records, ensure_ascii=False)

JS = r'''
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

const DATA = __DATA__;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');
const dry = process.argv.includes('--dry');
const db = new Database(DB_PATH, { readonly: dry, fileMustExist: true });
if (!dry) db.pragma('busy_timeout = 30000');

const uid = () => crypto.randomBytes(8).toString('hex');
const now = () => new Date().toISOString();
const listEntities = (type) =>
  db.prepare('SELECT * FROM entities WHERE type = ?').all(type).map((r) => ({ id: r.id, ...JSON.parse(r.data) }));

function createEntity(type, data) {
  const id = uid();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?,?,?,?,?)')
    .run(id, type, JSON.stringify(data), now(), now());
  return { id, ...data };
}

const existingSuppliers = listEntities('Supplier');
const supplierByName = new Map();
for (const s of existingSuppliers) {
  const key = (s.name || '').trim().toLowerCase();
  if (key) supplierByName.set(key, s);
}

const categories = listEntities('SupplierCategory');
let hotelsCat = categories.find((c) => (c.name || '').toLowerCase() === 'hotels');

const existingPricings = listEntities('SupplierPricing');
const allSubs = dry ? [] : listEntities('SupplierSubcategory');
function pricingExists(supplierId, p) {
  return existingPricings.find(
    (x) =>
      x.supplier_id === supplierId &&
      (x.name || '').toLowerCase() === p.room_type.toLowerCase() &&
      (x.occupancy || '') === p.occ &&
      (x.meal_treatment || '') === p.meal &&
      (x.season_start || '') === p.start &&
      (x.season_end || '') === p.end &&
      Number(x.client_price) === Number(p.sell),
  );
}

let suppliersCreated = 0;
let suppliersReused = 0;
let subcatsCreated = 0;
let pricingsCreated = 0;
let pricingsSkipped = 0;

const run = db.transaction(() => {
  if (!hotelsCat) {
    if (dry) {
      hotelsCat = { id: 'WOULD_CREATE', name: 'Hotels' };
    } else {
      hotelsCat = createEntity('SupplierCategory', { name: 'Hotels', description: '', icon: '', color: '#0ea5e9' });
    }
  }

  const byHotel = new Map();
  for (const rec of DATA) {
    if (!byHotel.has(rec.hotel)) byHotel.set(rec.hotel, []);
    byHotel.get(rec.hotel).push(rec);
  }

  for (const [hotel, recs] of byHotel) {
    const key = hotel.trim().toLowerCase();
    let supplier = supplierByName.get(key);
    if (supplier) {
      suppliersReused++;
    } else {
      if (dry) {
        supplier = { id: 'WOULD_CREATE_' + suppliersCreated, name: hotel };
        suppliersCreated++;
      } else {
        supplier = createEntity('Supplier', {
          name: hotel,
          city: recs[0].city || '',
          area: recs[0].region || '',
          rating: null,
          address: '',
          website: '',
          operator: recs[0].operator || '',
          star_rating: recs[0].star || '',
          region: recs[0].region || '',
        });
        supplierByName.set(key, supplier);
        suppliersCreated++;
      }
    }

    // ensure a Hotels subcategory for this supplier
    const subs = allSubs.filter((s) => s.supplier_id === supplier.id);
    let sub = subs.find((s) => s.category_id === hotelsCat.id) || null;
    if (!sub) {
      if (dry) {
        subcatsCreated++;
      } else {
        sub = createEntity('SupplierSubcategory', {
          supplier_id: supplier.id,
          category_id: hotelsCat.id,
          name: 'Hotels',
        });
        subcatsCreated++;
      }
    }
    const subId = sub ? sub.id : (dry ? 'WOULD_CREATE_SUB' : null);

    for (const p of recs) {
      if (dry) {
        pricingsCreated++;
        continue;
      }
      if (pricingExists(supplier.id, p)) {
        pricingsSkipped++;
        continue;
      }
      createEntity('SupplierPricing', {
        supplier_id: supplier.id,
        subcategory_id: subId,
        name: p.room_type,
        description: `${p.room} · ${p.board}`,
        base_price: Number(p.buy),
        client_price: Number(p.sell),
        currency: p.cur,
        unit: 'per_night',
        season_type: 'custom',
        season_start: p.start,
        season_end: p.end,
        min_quantity: 1,
        max_quantity: null,
        occupancy: p.occ,
        meal_treatment: p.meal,
        child_price: null,
        child_client_price: null,
        is_active: true,
        approval_status: 'approved',
      });
      pricingsCreated++;
    }
  }
});

run();
db.close();

console.log(JSON.stringify({
  mode: dry ? 'DRY_RUN' : 'APPLIED',
  hotels: byHotelSize(),
  suppliersCreated,
  suppliersReused,
  subcatsCreated,
  pricingsCreated,
  pricingsSkipped,
}, null, 2));

function byHotelSize() {
  const m = new Map();
  for (const r of DATA) {
    if (!m.has(r.hotel)) m.set(r.hotel, true);
  }
  return m.size;
}
'''

JS = JS.replace("__DATA__", data_json)

out = "/tmp/import_hotels.mjs"
with open(out, "w") as f:
    f.write(JS)

b64 = base64.b64encode(JS.encode("utf-8")).decode("ascii")
with open("/tmp/import_hotels.b64", "w") as f:
    f.write(b64)

print("records:", len(records))
print("unique hotels:", len(set(r["hotel"] for r in records)))
print("script bytes:", len(JS), "b64 len:", len(b64))
print("written:", out)
