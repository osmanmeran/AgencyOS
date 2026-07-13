// Incident fix for the 014/015 rollout: subcategories had only ever been
// used by hotel suppliers (for room tiers). Non-hotel suppliers — transfers,
// tours, car rental, etc. — had a category set directly on the Supplier but
// no subcategory at all, so migration 015's backfill (which only updates
// *existing* subcategories) left them with no category and they vanished
// from every category filter.
//
// This recreates a default "General" subcategory for each affected
// supplier, using its pre-015 category recovered from the automatic
// pre-migration backup taken on 2026-07-07. Guarded so it only acts on
// suppliers that still have zero subcategories (no-op everywhere else,
// including fresh installs and dev).
import crypto from 'crypto';

const RECOVERED_SUPPLIER_CATEGORY = {
  n5m26jzr: 'ic550l2y', // Marveltour -> Package Trip
  nnorctl8: 'hsjiflkk', // Hagia Sophia Mansions -> Hotels
  r7s2evm8: '205rzvzw', // Laal VIP -> Transfers
  icdri78z: 'ng10ozx8', // ZeplinCar -> Rent a Car
  qyxbjldu: 'ic550l2y', // Crossroads -> Package Trip
  qhqc2j44: 'hsjiflkk', // Amira Hotel -> Hotels
  p0znyome: 'hsjiflkk', // Mithra Cave -> Hotels
  pszbfqxv: 'f58headx', // Cappadocia Hot air Balloon -> Extra Activities
  xa4ne7tp: 'hsjiflkk', // Sarnic Premier -> Hotels
  lw4butpt: 'hsjiflkk', // Mikro DMG -> Hotels
  gfnh46jk: 'hsjiflkk', // Ciragan Kempinski Hotel -> Hotels
  gfnjx8tv: 'hsjiflkk', // Avantgarde Refined Cappadocia -> Hotels
  b87oy53q: 'hsjiflkk', // Grand Yavuz Hotel -> Hotels
  '3u7vtxs4': 'ng10ozx8', // Enterprise -> Rent a Car
  o6eswo1w: 'ng10ozx8', // Enterprise -> Rent a Car
  '172uste2': 'ng10ozx8', // Enterprise -> Rent a Car
  '2voqao6q': 'hsjiflkk', // New Park Hotel -> Hotels
  '0p8vjmxg': 'hsjiflkk', // Hotel Asikoglu -> Hotels
  '0auzfn0t': 'hsjiflkk', // Sacred Mansion -> Hotels
  '4tb9thyc': 'hsjiflkk', // Pertevniyal Aziziye Hotel -> Hotels
  '1jstqizq': 'hsjiflkk', // Adempira Hotel -> Hotels
  nbclv8iv: 'hsjiflkk', // Hemerans & Anatolia -> Hotels
  k2cl30xv: 'hsjiflkk', // Celsus Boutique -> Hotels
  zb40cdp6: 'hsjiflkk', // Orchis -> Hotels
  t33fc0ul: 'hsjiflkk', // The Marmara Suadiye -> Hotels
  e3148996a264b4ff: 'hsjiflkk', // Radisson Blu Bosphorus -> Hotels
  '2ed165db3cfe1324': 'hsjiflkk', // Moxy Istanbul Beyoglu Hotel -> Hotels
  a2f969f5cc89042b: 'hsjiflkk', // Urgup Konak Hotel -> Hotels
  a9de2c79d3bf4370: '205rzvzw', // Marvel Tour - Transfer & Treno (self-operated) -> Transfers
  ef646cb9bfc5413f: 'f58headx', // Marmara Pera Rooftop -> Extra Activities
  '1a0e814f4535329a': 'hsjiflkk', // Lokalist -> Hotels
};

export function up(db) {
  const now = new Date().toISOString();
  const insertEntity = db.prepare(
    'INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)',
  );
  const uid = () => crypto.randomBytes(8).toString('hex');

  const existingSupplierIds = new Set(
    db
      .prepare("SELECT id FROM entities WHERE type = 'Supplier'")
      .all()
      .map((r) => r.id),
  );
  const subcatCountBySupplier = new Map();
  for (const r of db.prepare("SELECT data FROM entities WHERE type = 'SupplierSubcategory'").all()) {
    const supplierId = JSON.parse(r.data).supplier_id;
    subcatCountBySupplier.set(supplierId, (subcatCountBySupplier.get(supplierId) || 0) + 1);
  }

  for (const [supplierId, categoryId] of Object.entries(RECOVERED_SUPPLIER_CATEGORY)) {
    if (!existingSupplierIds.has(supplierId)) continue;
    if (subcatCountBySupplier.get(supplierId)) continue;
    const data = { supplier_id: supplierId, category_id: categoryId, name: 'General' };
    insertEntity.run(uid(), 'SupplierSubcategory', JSON.stringify(data), now, now);
  }
}

export function down() {
  // Not reversible: would need to distinguish these seeded rows from ones a
  // user has since edited or added services to. Leave as-is on rollback.
}
