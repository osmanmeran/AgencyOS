import openpyxl, json, re, base64

wb = openpyxl.load_workbook("/Users/osmanmeran/Documenti computer/deneme.xlsx", data_only=True)
ws = wb["deneme"]
rows = list(ws.iter_rows(values_only=True))[1:]

stars = {}
for r in rows:
    if not r or not r[0]:
        continue
    hotel = str(r[0]).strip()
    raw = str(r[1]).strip()
    m = re.sub(r"[^0-9]", "", raw)
    if not m:
        continue
    stars[hotel] = int(m)  # one star value per hotel (verified consistent)

data_json = json.dumps(stars, ensure_ascii=False)

JS = r'''
import Database from 'better-sqlite3';
import path from 'path';

const STARS = __DATA__;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');
const dry = process.argv.includes('--dry');
const db = new Database(DB_PATH, { readonly: dry, fileMustExist: true });
if (!dry) db.pragma('busy_timeout = 30000');
const now = () => new Date().toISOString();

const suppliers = db.prepare("SELECT * FROM entities WHERE type = 'Supplier'").all()
  .map((r) => ({ id: r.id, ...JSON.parse(r.data) }));

let updated = 0, notFound = 0;
const run = db.transaction(() => {
  for (const [name, star] of Object.entries(STARS)) {
    const sup = suppliers.find((s) => (s.name || '').trim().toLowerCase() === name.toLowerCase());
    if (!sup) { notFound++; continue; }
    if (dry) { updated++; continue; }
    db.prepare("UPDATE entities SET data = json_set(data, '$.rating', ?, '$.star_rating', ?), updated_date = ? WHERE id = ?")
      .run(star, star, now(), sup.id);
    updated++;
  }
});
run();
db.close();
console.log(JSON.stringify({ mode: dry ? 'DRY_RUN' : 'APPLIED', hotelsInSheet: Object.keys(STARS).length, updated, notFound }, null, 2));
'''

JS = JS.replace("__DATA__", data_json)
with open("/tmp/set_stars.mjs", "w") as f:
    f.write(JS)
with open("/tmp/set_stars.b64", "w") as f:
    f.write(base64.b64encode(JS.encode("utf-8")).decode("ascii"))
print("hotels with stars:", len(stars))
print("b64 len:", len(open("/tmp/set_stars.b64").read()))
