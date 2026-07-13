// Stores the most recent daily snapshot of currency exchange rates, fetched
// from a public rates API by the exchange-rate scheduler (see
// server/services/exchangeRateScheduler.js). A single row (id = 1) holds the
// full USD-based rate table plus the source and the fetch timestamp, so the
// app always has a known-good rateset even if the external API is briefly
// unreachable.
export function up(db) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rates TEXT NOT NULL,
      source TEXT,
      updated_at TEXT NOT NULL
    )`,
  ).run();
}

export function down(db) {
  db.prepare('DROP TABLE IF EXISTS exchange_rates').run();
}
