// One-off seed: import the daily guided tours from the Italian "Escursioni
// guidate Turchia" document as GuidedTour entities (mode: 'daily'), linked to
// the "Marvel tour" supplier. Descriptions are translated to English (the
// catalog's default language); the tour operating language follows the source
// (Italian), except Ephesus/Pamukkale which the document lists with
// English-speaking guides.
//
// Run with: node scripts/seedItalianDailyTours.mjs
import { createEntity } from '../server/services/entities.js';
import { getDb } from '../server/db.js';

const admin = { user_tier: 'admin', id: 'seed-italian-tours', custom_permissions: [] };

const tours = [
  {
    name: 'Istanbul A – Historic Peninsula Walking Tour',
    language: 'it',
    location: 'Istanbul',
    mealTreatment: 'Not included',
    transportation: false,
    tourStyle: 'regular',
    sights: ['Blue Mosque', 'Roman Hippodrome', 'Hagia Sophia', 'Basilica Cistern', 'Grand Bazaar'],
    description:
      "Full-day walking tour of Istanbul's historic peninsula using public transport. Visit the majestic Blue Mosque (Sultanahmet Camii) and the Roman Hippodrome, once the social and political heart of Constantinople. After free time for lunch, explore Hagia Sophia (Ayasofya), the Basilica Cistern (Yerebatan Sarnıcı), and finish at the Grand Bazaar (Kapalı Çarşı) for a unique shopping experience. Lunch is not included; entry fees are included. Operated with an Italian-speaking professional guide.",
    minOccupancy: 1,
    maxOccupancy: 9,
    pricingTiers: [
      { minParticipants: 1, maxParticipants: 1, price: 355 },
      { minParticipants: 2, maxParticipants: 2, price: 205 },
      { minParticipants: 3, maxParticipants: 3, price: 160 },
      { minParticipants: 4, maxParticipants: 5, price: 125 },
      { minParticipants: 6, maxParticipants: 9, price: 105 },
    ],
  },
  {
    name: 'Istanbul B – Imperial Landmarks Walking Tour',
    language: 'it',
    location: 'Istanbul',
    mealTreatment: 'Not included',
    transportation: false,
    tourStyle: 'regular',
    sights: ['Topkapi Palace', 'Süleymaniye Mosque', 'Spice Market', 'Rüstem Pasha Mosque', 'Bosphorus Ferry'],
    description:
      "Walking tour of Istanbul's imperial landmarks by public transport. Begin at Topkapi Palace, residence of the Ottoman sultans, then the Süleymaniye Mosque. After lunch (not included), browse the Spice Market (Mısır Çarşısı) and the tile-decorated Rüstem Pasha Mosque, ending with a regular Bosphorus ferry ride between Europe and Asia. Lunch not included; entries included. Italian-speaking guide.",
    minOccupancy: 1,
    maxOccupancy: 9,
    pricingTiers: [
      { minParticipants: 1, maxParticipants: 1, price: 350 },
      { minParticipants: 2, maxParticipants: 2, price: 210 },
      { minParticipants: 3, maxParticipants: 3, price: 165 },
      { minParticipants: 4, maxParticipants: 5, price: 130 },
      { minParticipants: 6, maxParticipants: 9, price: 110 },
    ],
  },
  {
    name: 'Istanbul C – Private Tour with Car',
    language: 'it',
    location: 'Istanbul',
    mealTreatment: 'Not included',
    transportation: true,
    tourStyle: 'private',
    sights: ['Dolmabahçe Palace', 'Karaköy Galataport', 'Taksim Istiklal', 'Galata Tower', 'Fener & Balat'],
    description:
      "Private tour of Istanbul with your own car and driver. Explore Dolmabahçe Palace, the Karaköy Galataport district, and the lively Taksim Istiklal & Pera area. Admire the Galata Tower from outside and wander the colorful historic neighborhoods of Fener and Balat. A private vehicle supplement applies (€165/day up to 5 pax); Italian-speaking professional guide.",
    minOccupancy: 1,
    maxOccupancy: 9,
    pricingTiers: [
      { minParticipants: 1, maxParticipants: 1, price: 520 },
      { minParticipants: 2, maxParticipants: 2, price: 285 },
      { minParticipants: 3, maxParticipants: 3, price: 210 },
      { minParticipants: 4, maxParticipants: 5, price: 165 },
      { minParticipants: 6, maxParticipants: 9, price: 130 },
    ],
  },
  {
    name: 'Istanbul D – Asian Side Walking Tour',
    language: 'it',
    location: 'Istanbul',
    mealTreatment: 'Not included',
    transportation: false,
    tourStyle: 'regular',
    sights: ['Beylerbeyi Palace', 'Üsküdar', 'Kuzguncuk', 'Kadıköy', 'Leander’s Tower'],
    description:
      "Walking tour of Istanbul's Asian side by public transport. Visit Beylerbeyi Palace, the waterfront district of Üsküdar, the picturesque streets of Kuzguncuk, and the vibrant Kadıköy market. Finish with a view of the Leander's Tower (Kız Kulesi) from outside before returning to the hotel. Lunch not included; Italian-speaking guide.",
    minOccupancy: 1,
    maxOccupancy: 9,
    pricingTiers: [
      { minParticipants: 1, maxParticipants: 1, price: 320 },
      { minParticipants: 2, maxParticipants: 2, price: 175 },
      { minParticipants: 3, maxParticipants: 3, price: 125 },
      { minParticipants: 4, maxParticipants: 5, price: 90 },
      { minParticipants: 6, maxParticipants: 9, price: 65 },
    ],
  },
  {
    name: 'Private Guide 8 Hours (Public Transport)',
    language: 'it',
    location: 'Istanbul',
    mealTreatment: 'Not included',
    transportation: false,
    tourStyle: 'private',
    sights: [],
    description:
      "Private Italian-speaking professional guide for 8 hours, using public transport. Ideal for a fully customized itinerary tailored to your interests across Istanbul. Entries and transport tickets are on your own; guide fee only.",
    minOccupancy: 1,
    maxOccupancy: 9,
    pricingTiers: [
      { minParticipants: 1, maxParticipants: 1, price: 300 },
      { minParticipants: 2, maxParticipants: 2, price: 160 },
      { minParticipants: 3, maxParticipants: 3, price: 110 },
      { minParticipants: 4, maxParticipants: 5, price: 75 },
      { minParticipants: 6, maxParticipants: 9, price: 60 },
    ],
  },
  {
    name: 'Cappadocia North Tour',
    language: 'it',
    location: 'Cappadocia',
    mealTreatment: 'Lunch included',
    transportation: true,
    tourStyle: 'private',
    sights: ['Devrent Valley', 'Paşabag', 'Avanos', 'Göreme Open-Air Museum'],
    description:
      "Private full-day tour of North Cappadocia. Discover the fairy chimneys of Paşabag, the Devrent Valley, the pottery town of Avanos on the Red River, and the Göreme Open-Air Museum with its Byzantine rock-cut churches. Includes hotel transfer, open buffet lunch, Italian-speaking official guide, entry fees, and A/C vehicle. Drinks, personal expenses, and tips (suggested €10/day guide, €5/day driver) not included.",
    minOccupancy: 2,
    maxOccupancy: 99,
    pricingTiers: [
      { minParticipants: 2, maxParticipants: 2, price: 210 },
      { minParticipants: 3, maxParticipants: 3, price: 180 },
      { minParticipants: 4, maxParticipants: 4, price: 170 },
      { minParticipants: 5, maxParticipants: 5, price: 160 },
      { minParticipants: 6, maxParticipants: 6, price: 150 },
      { minParticipants: 7, maxParticipants: 99, price: 130 },
    ],
  },
  {
    name: 'Cappadocia South Tour',
    language: 'it',
    location: 'Cappadocia',
    mealTreatment: 'Lunch included',
    transportation: true,
    tourStyle: 'private',
    sights: ['Red Valley', 'Çavuşin', 'Ortahisar', 'Pigeon Valley', 'Özkonak Underground City'],
    description:
      "Private full-day tour of South Cappadocia. Explore the Red Valley via Çavuşin and its rock-cut churches, hike around the old abandoned village, visit Pigeon Valley, and the underground city of Özkonak (approx. four levels open, refuge for up to 5,000 people). Includes hotel transfer, open buffet lunch, Italian-speaking official guide, entry fees, and A/C vehicle. Drinks, personal expenses, and tips not included.",
    minOccupancy: 2,
    maxOccupancy: 99,
    pricingTiers: [
      { minParticipants: 2, maxParticipants: 2, price: 210 },
      { minParticipants: 3, maxParticipants: 3, price: 180 },
      { minParticipants: 4, maxParticipants: 4, price: 170 },
      { minParticipants: 5, maxParticipants: 5, price: 160 },
      { minParticipants: 6, maxParticipants: 6, price: 150 },
      { minParticipants: 7, maxParticipants: 99, price: 130 },
    ],
  },
  {
    name: 'Cappadocia Green – Ihlara Valley Tour',
    language: 'it',
    location: 'Cappadocia',
    mealTreatment: 'Lunch included',
    transportation: true,
    tourStyle: 'private',
    sights: ['Derinkuyu Underground City', 'Ihlara Valley', 'Belisirma', 'Selime Monastery', 'Yaprakhisar'],
    description:
      "Private full-day tour of the Ihlara Valley (Green Tour). Panoramic view over Göreme from Esentepe, the deep Derinkuyu underground city, a riverside walk through the Ihlara Valley's rock-cut churches, lunch at Belisirma village by the river, and the rock-cut Selime Monastery. Includes hotel transfer, lunch, Italian-speaking official guide, entry fees, and A/C vehicle. Drinks, personal expenses, and tips not included.",
    minOccupancy: 2,
    maxOccupancy: 99,
    pricingTiers: [
      { minParticipants: 2, maxParticipants: 2, price: 210 },
      { minParticipants: 3, maxParticipants: 3, price: 180 },
      { minParticipants: 4, maxParticipants: 4, price: 170 },
      { minParticipants: 5, maxParticipants: 5, price: 160 },
      { minParticipants: 6, maxParticipants: 6, price: 150 },
      { minParticipants: 7, maxParticipants: 99, price: 130 },
    ],
  },
  {
    name: 'Ephesus Tour',
    language: 'en',
    location: 'Ephesus',
    mealTreatment: 'Lunch included',
    transportation: true,
    tourStyle: 'private',
    sights: ['Isa Bey Mosque', 'Ephesus', 'House of Virgin Mary', 'Temple of Artemis'],
    description:
      "Full-day tour to Ephesus. Visit the Isa Bey Mosque, the ancient city of Ephesus (Celsus Library, Temple of Hadrian, Trajan Fountain, Great Theatre where St. Paul preached), a Turkish carpet cooperative, the House of the Virgin Mary, and the Temple of Artemis. Open-air Turkish lunch included. Note: the included guide for this tour is English-speaking. Entries and A/C vehicle included; drinks and tips not included.",
    minOccupancy: 2,
    maxOccupancy: 7,
    pricingTiers: [
      { minParticipants: 2, maxParticipants: 2, price: 275 },
      { minParticipants: 3, maxParticipants: 3, price: 220 },
      { minParticipants: 4, maxParticipants: 5, price: 210 },
      { minParticipants: 6, maxParticipants: 7, price: 190 },
    ],
  },
  {
    name: 'Pamukkale & Hierapolis Tour',
    language: 'en',
    location: 'Pamukkale',
    mealTreatment: 'Lunch included',
    transportation: true,
    tourStyle: 'private',
    sights: ['Hierapolis', 'Pamukkale Travertines', 'Necropolis', 'Thermal Pools'],
    description:
      "Full-day tour to Pamukkale & Hierapolis. Explore the white travertine terraces, the beautifully preserved Necropolis, the main street and gates, the thermal baths, the Plutonium and the theatre of Hierapolis. Optional therapeutic thermal swimming. Open-air Turkish lunch included. Note: the included guide for this tour is English-speaking. Entries and A/C vehicle included; drinks and tips not included.",
    minOccupancy: 2,
    maxOccupancy: 7,
    pricingTiers: [
      { minParticipants: 2, maxParticipants: 2, price: 320 },
      { minParticipants: 3, maxParticipants: 3, price: 270 },
      { minParticipants: 4, maxParticipants: 5, price: 260 },
      { minParticipants: 6, maxParticipants: 7, price: 235 },
    ],
  },
];

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
for (const t of tours) {
  if (alreadyExists(db, t.name)) {
    console.log(`skip (exists): ${t.name}`);
    continue;
  }
  const payload = {
    ...t,
    mode: 'daily',
    supplierId,
    supplierName,
    durationDays: 1,
    dayDescriptions: [],
    featured: false,
    specialOffer: { percent: 0, startDate: '', endDate: '' },
  };
  const createdTour = createEntity('GuidedTour', payload, admin);
  console.log(`created: ${createdTour.name} (${createdTour.id})`);
  created += 1;
}

console.log(`\nDone. Created ${created} new daily tours linked to supplier "${supplierName}" (id: ${supplierId}).`);
