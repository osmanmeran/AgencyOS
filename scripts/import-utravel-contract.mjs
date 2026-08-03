// One-time import of the Utravel <> Marvel Tour "Tour Turchia: Istanbul +
// Cappadocia" seasonal contract (nov25-ott26). Safe to run more than once:
// it looks up existing records by name/email instead of hardcoding ids, so
// re-running it updates/reuses what's already there rather than duplicating.
//
// Run this from inside the production environment (where data/marvelops.db
// lives on the persistent volume), e.g.:
//   railway ssh
//   node scripts/import-utravel-contract.mjs

import { getDb, closeDb } from '../server/db.js';
import { createEntity, updateEntity, findEntities } from '../server/services/entities.js';

const sysUser = { id: 'system-import', user_tier: 'admin', custom_permissions: [] };

function findCategoryId(categories, pattern) {
  const cat = categories.find(c => pattern.test(c.name || ''));
  if (!cat) throw new Error(`No SupplierCategory matching ${pattern} found — create it first, then re-run.`);
  return cat.id;
}

function findOrCreateSupplier(suppliers, name, categoryId, extra) {
  const existing = suppliers.find(s => (s.name || '').toLowerCase() === name.toLowerCase());
  if (existing) {
    console.log(`SUPPLIER (existing) ${name} -> ${existing.id}`);
    return existing;
  }
  const created = createEntity('Supplier', { name, category_id: categoryId, ...extra }, sysUser);
  console.log(`SUPPLIER (created)  ${name} -> ${created.id}`);
  return created;
}

getDb();

const categories = findEntities('SupplierCategory', { user: sysUser });
const CAT_HOTELS = findCategoryId(categories, /hotel/i);
const CAT_TRANSFERS = findCategoryId(categories, /transfer/i);
const CAT_EXTRA_ACT = findCategoryId(categories, /extra activit/i);

// 1. Client: reuse an existing Utravel record if one exists (matched by email
// domain or name), otherwise create one from scratch.
const clients = findEntities('Client', { user: sysUser });
let client = clients.find(c =>
  (c.email || '').toLowerCase().includes('4utravel') ||
  (c.name || '').toLowerCase().includes('utravel')
);

const utravelFields = {
  name: 'Utravel S.r.l.',
  company: 'Utravel S.r.l.',
  email: client?.email || 'operativo@4utravel.it',
  address: 'Via Lugaro, 15',
  city: 'Torino',
  country: 'Italia',
  tax_id: '12176650013',
  notes: 'Contratto stagionale Tour Turchia (Istanbul+Cappadocia), 01/11/2025-10/10/2026, firmato 11/06/2025. Referente: Elia Incardona (Junior Contract Manager). Company part of Alpitour S.p.A. REA TO 1270365.',
  fixed_extras: [
    { _key: 'extra-transfer-ist', name: 'Transfer privato Aeroporto Istanbul Atatürk (IST) ↔ hotel, 1-5 pax', unit: 'per_car', quantity: 1, acquiring_price: 50, selling_price: 50, currency: 'EUR' },
    { _key: 'extra-transfer-saw', name: 'Transfer privato Aeroporto Istanbul Sabiha Gökçen (SAW) ↔ hotel, 1-5 pax', unit: 'per_car', quantity: 1, acquiring_price: 57, selling_price: 57, currency: 'EUR' },
    { _key: 'extra-single-supp', name: 'Supplemento Camera Singola (intero tour)', unit: 'per_person', quantity: 1, acquiring_price: 0, selling_price: 310, currency: 'EUR' },
    { _key: 'extra-triple-red', name: 'Riduzione Camera Tripla (intero tour, per adulto)', unit: 'per_person', quantity: 1, acquiring_price: 0, selling_price: -55, currency: 'EUR' },
  ],
};

if (client) {
  client = updateEntity('Client', client.id, utravelFields, sysUser);
  console.log(`CLIENT (updated) ${client.name} -> ${client.id}`);
} else {
  client = createEntity('Client', utravelFields, sysUser);
  console.log(`CLIENT (created) ${client.name} -> ${client.id}`);
}

// 2. Suppliers referenced by the itinerary.
const suppliers = findEntities('Supplier', { user: sysUser });
const moxy = findOrCreateSupplier(suppliers, 'Moxy Istanbul Beyoglu Hotel', CAT_HOTELS, {
  city: 'Istanbul', area: 'Beyoglu', rating: 4,
  notes: 'Cat. 4* - contratto Utravel/Marvel Tour Tour Turchia nov25-ott26. "O similare" per contratto.',
});
const urgup = findOrCreateSupplier(suppliers, 'Urgup Konak Hotel', CAT_HOTELS, {
  city: 'Cappadocia', area: 'Urgup', rating: 3,
  notes: 'Cat. 3* - contratto Utravel/Marvel Tour Tour Turchia nov25-ott26. "O similare" per contratto.',
});
const transferSupplier = findOrCreateSupplier(suppliers, 'Marvel Tour - Transfer & Treno (self-operated)', CAT_TRANSFERS, {
  city: 'Istanbul/Ankara/Cappadocia',
  notes: 'Servizio gestito direttamente da Marvel Tour con assistente in lingua inglese: transfer hotel Istanbul<->stazione, treno AV 1a classe Istanbul-Ankara A/R, transfer Ankara<->Cappadocia. Non e\' un fornitore esterno.',
});
const marmara = findOrCreateSupplier(suppliers, 'Marmara Pera Rooftop', CAT_EXTRA_ACT, {
  city: 'Istanbul',
  notes: 'Ingresso + 1 cocktail incluso nel pacchetto, dopo cena. Costo netto 23 EUR/persona, fatturato a Utravel.',
});

// 3. The contract itself — skip if a contract with this exact name already exists.
const CONTRACT_NAME = 'Tour Turchia: Istanbul + Cappadocia — Utravel (stagione nov25-ott26)';
const existingContracts = findEntities('TourContract', { user: sysUser });
const existingContract = existingContracts.find(c => c.name === CONTRACT_NAME);

if (existingContract) {
  console.log(`CONTRACT (already exists, skipped) ${CONTRACT_NAME} -> ${existingContract.id}`);
} else {
  const contract = createEntity('TourContract', {
    name: CONTRACT_NAME,
    client_id: client.id,
    client_name: client.name,
    destination: 'Istanbul & Cappadocia, Turchia',
    is_active: true,
    itinerary: [
      {
        _key: 'it-ist-1', day_offset_start: 0, day_offset_end: 3, category: 'Hotels ',
        name: 'Moxy Istanbul Beyoglu Hotel (o similare) 4*', description: 'Trattamento B&B, 3 notti',
        supplier_id: moxy.id, supplier_name: moxy.name, unit: 'per_night', quantity: 1,
        acquiring_price: 0, supplier_currency: 'EUR', hotel_treatment: 'Bed & Breakfast', show_in_itinerary: true,
      },
      {
        _key: 'it-transfer-out', day_offset_start: 3, day_offset_end: 3, category: 'Transfers',
        name: 'Transfer Hotel Istanbul → Stazione + Treno AV Istanbul-Ankara + Transfer Ankara → Cappadocia',
        description: 'Con assistente Marvel Tour in lingua inglese, treno alta velocità 1a classe',
        supplier_id: transferSupplier.id, supplier_name: transferSupplier.name, unit: 'per_person', quantity: 1,
        acquiring_price: 0, supplier_currency: 'EUR', transfer_type: 'Point to Point', show_in_itinerary: true,
      },
      {
        _key: 'it-cap', day_offset_start: 3, day_offset_end: 6, category: 'Hotels ',
        name: 'Urgup Konak Hotel (o similare) 3*', description: 'Trattamento B&B, 3 notti',
        supplier_id: urgup.id, supplier_name: urgup.name, unit: 'per_night', quantity: 1,
        acquiring_price: 0, supplier_currency: 'EUR', hotel_treatment: 'Bed & Breakfast', show_in_itinerary: true,
      },
      {
        _key: 'it-transfer-back', day_offset_start: 6, day_offset_end: 6, category: 'Transfers',
        name: 'Transfer Cappadocia → Ankara + Treno AV Ankara-Istanbul + Transfer Stazione → Hotel Istanbul',
        description: 'Con assistente Marvel Tour in lingua inglese, treno alta velocità 1a classe',
        supplier_id: transferSupplier.id, supplier_name: transferSupplier.name, unit: 'per_person', quantity: 1,
        acquiring_price: 0, supplier_currency: 'EUR', transfer_type: 'Point to Point', show_in_itinerary: true,
      },
      {
        _key: 'it-ist-2', day_offset_start: 6, day_offset_end: 7, category: 'Hotels ',
        name: 'Moxy Istanbul Beyoglu Hotel (o similare) 4* - ultima notte', description: 'Trattamento B&B, 1 notte',
        supplier_id: moxy.id, supplier_name: moxy.name, unit: 'per_night', quantity: 1,
        acquiring_price: 0, supplier_currency: 'EUR', hotel_treatment: 'Bed & Breakfast', show_in_itinerary: true,
      },
      {
        _key: 'it-marmara', day_offset_start: 0, day_offset_end: 0, category: 'Extra Activities ',
        name: 'Marmara Pera Rooftop + 1 cocktail incluso', description: 'Attività inclusa nel pacchetto, dopo cena',
        supplier_id: marmara.id, supplier_name: marmara.name, unit: 'per_person', quantity: 1,
        acquiring_price: 23, supplier_currency: 'EUR', show_in_itinerary: true,
      },
    ],
    pricing_tiers: [
      { _key: 'pt-4', pax: 4, price_per_person: 560, currency: 'EUR' },
      { _key: 'pt-5', pax: 5, price_per_person: 540, currency: 'EUR' },
      { _key: 'pt-6', pax: 6, price_per_person: 500, currency: 'EUR' },
      { _key: 'pt-7', pax: 7, price_per_person: 480, currency: 'EUR' },
      { _key: 'pt-8', pax: 8, price_per_person: 460, currency: 'EUR' },
      { _key: 'pt-9', pax: 9, price_per_person: 455, currency: 'EUR' },
      { _key: 'pt-10', pax: 10, price_per_person: 445, currency: 'EUR' },
      { _key: 'pt-11', pax: 11, price_per_person: 435, currency: 'EUR' },
      { _key: 'pt-12', pax: 12, price_per_person: 430, currency: 'EUR' },
    ],
    terms_and_conditions:
`Cancellazione: gratuita fino a 8 giorni prima della partenza. Dal 7° giorno prima: penale 100%. Penale treno 5 EUR sempre applicata (2,50 EUR Utravel + 2,50 EUR Marvel Tour) anche in caso di cancellazione entro 8 giorni.
Release: 14 giorni prima di ogni partenza per tutte le date. Entro tale termine Marvel Tour garantisce prezzo, disponibilità e servizi; oltre, tutto va riconfermato.
Rooming list: da inviare a Marvel Tour a 21, 14 e 7 giorni dalla partenza.
Pagamento: 30 giorni data fattura.
Allotment: 8 camere (doppia/tripla) per ogni data di partenza.
Esclusiva: NO.`,
    notes:
`Date di partenza contrattualizzate (7 notti / 8 giorni ciascuna): 01/11/2025, 06/12/2025, 25/04/2026, 02/05/2026, 06/06/2026, 13/06/2026, 18/07/2026, 25/07/2026, 15/08/2026, 05/09/2026, 26/09/2026, 03/10/2026.
ATTENZIONE: la data di fine per la partenza del 25/04/2026 nel PDF originale è illeggibile/errata ("12/03/1956"); ho assunto 02/05/2026 seguendo lo schema di 7 notti comune a tutte le altre date (che coincide con la partenza successiva) — verificare con Marvel Tour.
Regole non modellate nel sistema (da gestire manualmente): accompagnatore (coach) sempre gratuito indipendentemente dal numero di partecipanti, anche con soli 3 pax, condivide camera; 1 posto gratuito ogni 20 partecipanti paganti; 1 gratuità aggiuntiva sull'attività Marmara Pera ogni 12 partecipanti.
Prezzi di acquisto (acquiring_price) delle righe itinerario impostati a 0 perché il contratto mostra solo il prezzo netto tutto incluso per persona (le fasce sopra), non il costo dettagliato per singolo servizio: da aggiornare quando disponibili i costi reali per hotel/transfer.`,
  }, sysUser);
  console.log(`CONTRACT (created) ${contract.name} -> ${contract.id}`);
}

closeDb();
console.log('Done.');
