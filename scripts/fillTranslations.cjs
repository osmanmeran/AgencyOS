// One-off helper: fill missing i18n keys into each locale JSON from
// scripts/translations/<locale>.json (flat "a.b.c" -> value maps).
// Only sets keys that are MISSING in the target locale — never overwrites
// existing translations. Run: node scripts/fillTranslations.cjs
const fs = require('fs');
const path = require('path');

const LOCALES = ['tr', 'it', 'fr', 'de', 'es'];
const localesDir = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');
const dataDir = path.join(__dirname, 'translations');

function hasPath(obj, kp) {
  return (
    kp.split('.').reduce((a, k) => (a && typeof a === 'object' && a[k] !== undefined ? a[k] : undefined), obj) !==
    undefined
  );
}
function setPath(obj, kp, val) {
  const parts = kp.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = val;
}

for (const loc of LOCALES) {
  const locPath = path.join(localesDir, `${loc}.json`);
  const flat = JSON.parse(fs.readFileSync(path.join(dataDir, `${loc}.json`), 'utf8'));
  const dict = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  let added = 0;
  for (const [k, v] of Object.entries(flat)) {
    if (!hasPath(dict, k)) {
      setPath(dict, k, v);
      added += 1;
    }
  }
  fs.writeFileSync(locPath, JSON.stringify(dict, null, 2) + '\n');
  console.log(`${loc}: added ${added} keys`);
}
