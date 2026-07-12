// Localize the seeded Italian daily tours:
//  1) Convert each existing tour's `description` into a localized map
//     { en: <current English>, it: <original Italian from the docx> }.
//  2) Add Italian-language variants of Ephesus and Pamukkale (same price &
//     treatments, language 'it', Italian name + description).
//
// Idempotent: re-running skips tours that already have an `it` description and
// skips variant tours that already exist.
//
// Run with: node scripts/localizeItalianTours.mjs
import { createEntity, updateEntity } from '../server/services/entities.js';
import { getDb } from '../server/db.js';

const admin = { user_tier: 'admin', id: 'seed-italian-tours', custom_permissions: [] };

// Original Italian descriptions (from "Escursioni guidate Turchia").
const ITALIAN = {
  'Istanbul A – Historic Peninsula Walking Tour':
    "Giro a piedi della penisola storica di Istanbul con mezzi pubblici. Inizia visitando la maestosa Moschea Blu (Sultanahmet Camii), poi l'Ippodromo Romano, centro della vita sociale e politica di Costantinopoli. Dopo il pranzo libero (non incluso), esplora la Moschea di Santa Sofia (Ayasofya), la Cisterna Basilica (Yerebatan Sarnıcı) e termina al Grand Bazaar (Kapalı Çarşı). Pranzo non incluso; ingressi inclusi. Guida professionale di lingua italiana.",
  'Istanbul B – Imperial Landmarks Walking Tour':
    "Giro a piedi dei luoghi imperiali di Istanbul con mezzi pubblici. Si inizia dal Palazzo Topkapi, residenza dei sultani ottomani, poi la Moschea di Solimano (Süleymaniye). Dopo il pranzo (non incluso), si visita il Mercato delle Spezie (Mısır Çarşısı) e la Moschea di Rustem Pascià, con i suoi mosaici di ceramica, concludendo con un giro in traghetto sul Bosforo tra Europa e Asia. Pranzo non incluso; ingressi inclusi. Guida di lingua italiana.",
  'Istanbul C – Private Tour with Car':
    "Tour privato di Istanbul con auto e autista. Si esplora il Palazzo Dolmabahçe, il quartiere di Karaköy Galataport e la vivace area di Taksim Istiklal e Pera. Si ammira la Torre di Galata dall'esterno e si passeggia nei colorati quartieri storici di Fener e Balat. Supplemento auto €165/giorno fino a 5 pax; guida professionale di lingua italiana.",
  'Istanbul D – Asian Side Walking Tour':
    "Giro a piedi della sponda asiatica di Istanbul con mezzi pubblici. Si visita il Palazzo Beylerbeyi, il quartiere di Üsküdar, le pittoresche vie di Kuzguncuk e il vivace mercato di Kadıköy. Si conclude con la vista della Torre di Leandro (Kız Kulesi) dall'esterno prima del rientro in hotel. Pranzo non incluso; guida di lingua italiana.",
  'Private Guide 8 Hours (Public Transport)':
    "Guida professionale privata di lingua italiana per 8 ore, con mezzi pubblici. Ideale per un itinerario personalizzato secondo i propri interessi a Istanbul. Ingressi e biglietti dei mezzi a carico del cliente; tariffa della sola guida.",
  'Cappadocia North Tour':
    "Tour privato di un'intera giornata nella Cappadocia Nord. Si scoprono i 'camini delle fate' di Paşabag, la valle del Dervent, il centro di ceramica di Avanos sul fiume Kızılırmak e il Museo all'aperto di Göreme con i suoi esempi di arte bizantina. Include transfer da/per hotel, pranzo a buffet aperto, guida ufficiale di lingua italiana, biglietti d'ingresso e veicolo con A/C. Non include bevande, spese personali e mance.",
  'Cappadocia South Tour':
    "Tour privato di un'intera giornata nella Cappadocia Sud. Si parte alla volta della Valle Rossa attraverso Çavuşin, con le sue chiese rupestri, e una passeggiata di 2 km; si visita poi il villaggio di Çavuşin e la Valle dei Piccioni. Nel pomeriggio si esplora la città sotterranea di Özkonak (circa 4 livelli visitabili, rifugio per fino a 5000 persone). Include transfer, pranzo, guida ufficiale di lingua italiana, ingressi e veicolo con A/C. Bevande, spese personali e mance escluse.",
  'Cappadocia Green – Ihlara Valley Tour':
    "Tour privato di un'intera giornata nella valle di Ihlara (Tour Verde). Vista panoramica su Göreme da Esentepe, la profonda città sotterranea di Derinkuyu, una passeggiata lungo il fiume tra le chiese rupestri della valle di Ihlara, pranzo al villaggio di Belisirma e il monastero rupestre di Selime. Include transfer, pranzo, guida ufficiale di lingua italiana, ingressi e veicolo con A/C. Bevande, spese personali e mance escluse.",
  'Ephesus Tour':
    "Tour di un'intera giornata a Efeso. Si visita la Moschea di Isa Bey, l'antica città greca e romana di Efeso (biblioteca di Celso, Tempio di Adriano, Fontana di Traiano, Grande Teatro dove predicò San Paolo), una cooperativa di tappeti, il santuario della Madre Maria e il Tempio di Artemide (una delle sette meraviglie del mondo antico). Pranzo turco all'aperto incluso. Nota: la guida inclusa per questo tour parla inglese. Ingressi e veicolo con A/C inclusi; bevande e mance escluse.",
  'Pamukkale & Hierapolis Tour':
    "Tour di un'intera giornata a Pamukkale e Hierapolis. Si esplorano le bianche terrazze di travertino, la magnifica Necropoli, la strada principale e le porte, le terme, il Plutonio e il teatro di Hierapolis. Possibilità di bagno terapeutico nelle acque termali. Pranzo turco all'aperto incluso. Nota: la guida inclusa per questo tour parla inglese. Ingressi e veicolo con A/C inclusi; bevande e mance escluse.",
};

// Italian variants of Ephesus / Pamukkale: name (Italian) + which English tour
// to clone pricing/treatments from.
const ITALIAN_VARIANTS = [
  {
    sourceName: 'Ephesus Tour',
    name: 'Tour di Efeso',
    language: 'it',
  },
  {
    sourceName: 'Pamukkale & Hierapolis Tour',
    name: 'Tour di Pamukkale e Hierapolis',
    language: 'it',
  },
];

const db = getDb();

function getTour(name) {
  return db
    .prepare("SELECT id, data FROM entities WHERE type='GuidedTour' AND json_extract(data,'$.name')=?")
    .get(name);
}

function hasIt(name) {
  const row = getTour(name);
  if (!row) return false;
  const data = JSON.parse(row.data);
  const d = data.description;
  if (d && typeof d === 'object') return !!d.it;
  return false;
}

// 1) Backfill en+it on existing tours.
let localized = 0;
for (const [name, itText] of Object.entries(ITALIAN)) {
  const row = getTour(name);
  if (!row) {
    console.log(`skip (not found): ${name}`);
    continue;
  }
  const data = JSON.parse(row.data);
  const current = data.description;
  const enText = typeof current === 'string' ? current : (current && current.en) || '';
  const merged = { en: enText, it: itText };
  if (current && typeof current === 'object' && current.es) merged.es = current.es;
  if (current && typeof current === 'object' && current.fr) merged.fr = current.fr;
  if (current && typeof current === 'object' && current.de) merged.de = current.de;
  if (current && typeof current === 'object' && current.tr) merged.tr = current.tr;
  updateEntity('GuidedTour', row.id, { description: merged }, admin);
  console.log(`localized: ${name}`);
  localized += 1;
}

// 2) Create Italian variants of Ephesus / Pamukkale.
let variants = 0;
for (const v of ITALIAN_VARIANTS) {
  if (getTour(v.name)) {
    console.log(`skip variant (exists): ${v.name}`);
    continue;
  }
  const src = getTour(v.sourceName);
  if (!src) {
    console.log(`skip variant (source missing): ${v.sourceName}`);
    continue;
  }
  const srcData = JSON.parse(src.data);
  const itText = ITALIAN[v.sourceName];
  const payload = {
    ...srcData,
    id: undefined,
    name: v.name,
    language: v.language,
    featured: false,
    description: { it: itText, en: typeof srcData.description === 'string' ? srcData.description : srcData.description?.en || '' },
  };
  const created = createEntity('GuidedTour', payload, admin);
  console.log(`created variant: ${created.name} (${created.id})`);
  variants += 1;
}

console.log(`\nDone. Localized ${localized} tours; created ${variants} Italian variants.`);
