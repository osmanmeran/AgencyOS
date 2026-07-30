// Functional index backing the public itinerary share link: resolving a
// share token to its Trip (server/services/itineraryShare.js) runs
// `WHERE type = 'Trip' AND json_extract(data, '$.share_token') = ?` against
// every tenant DB in turn (the token, not the Host header, is what identifies
// the workspace — see locateInvite() for the same pattern with invite
// tokens). Without this index each lookup would scan every Trip row in a
// tenant before moving to the next tenant. Same guard as migration 013: skip
// if any row's JSON is malformed rather than crash startup.
export function up(db) {
  const malformed = db.prepare('SELECT COUNT(*) AS c FROM entities WHERE json_valid(data) = 0').get().c;
  if (malformed > 0) {
    console.warn(`[Migrations] 022: ${malformed} entity row(s) contain malformed JSON; skipping share_token index.`);
    return;
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_entities_type_share_token
      ON entities(type, json_extract(data, '$.share_token'))
  `);
}

export function down(db) {
  db.exec(`DROP INDEX IF EXISTS idx_entities_type_share_token;`);
}
