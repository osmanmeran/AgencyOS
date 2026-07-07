// Composite functional indexes on the entities table's JSON payload.
//
// Entity rows store their fields as JSON in `data`, and the only pre-existing
// index is idx_entities_type. Several hot queries filter `type = ?` together
// with a json_extract() expression in SQL (dashboard revenue overview, invoice
// reminders, the B2B catalog/quotes). Without a matching index the planner
// finds the type via idx_entities_type and then scans every row of that type,
// evaluating json_extract per row (and, for the dues query, building a temp
// B-tree to sort).
//
// Each index below is `(type, <json_extract expr>)` so the planner can seek
// straight to matching (type, value) pairs. The expression text must match the
// query's exactly for SQLite to use it — keep these in sync with the queries in
// services/reports.js, services/reminders.js, and routes/b2b.js.
//
// SQLite evaluates json_extract() for every row when building a functional
// index and raises "malformed JSON" if any row's `data` isn't valid JSON —
// which would abort this migration and crash startup. The app always writes
// via JSON.stringify so that never happens in practice, but we still guard:
// if any malformed row exists we skip the indexes (a scan is slower, not
// broken) rather than take the process down. This keeps CREATE INDEX out of
// the throwing path entirely.
const INDEX_STATEMENTS = [
  // reports.js (ClientPayment/Invoice/Proposal status) + reminders.js (invoice status)
  `CREATE INDEX IF NOT EXISTS idx_entities_type_status
     ON entities(type, json_extract(data, '$.status'))`,
  // reports.js upcoming dues + reminders.js due-soon/overdue (range + ORDER BY)
  `CREATE INDEX IF NOT EXISTS idx_entities_type_due_date
     ON entities(type, json_extract(data, '$.due_date'))`,
  // reports.js confirmed-this-month trips (dashboard revenue overview)
  `CREATE INDEX IF NOT EXISTS idx_entities_type_proposal_status
     ON entities(type, json_extract(data, '$.proposal_status'))`,
  // b2b.js /quotes: scope a client's QuoteRequests
  `CREATE INDEX IF NOT EXISTS idx_entities_type_client_id
     ON entities(type, json_extract(data, '$.client_id'))`,
  // b2b.js /catalog: approved, active SupplierPricing (client-facing e-shop)
  `CREATE INDEX IF NOT EXISTS idx_entities_type_approval_status
     ON entities(type, json_extract(data, '$.approval_status'))`,
];

function up(db) {
  const malformed = db.prepare('SELECT COUNT(*) AS c FROM entities WHERE json_valid(data) = 0').get().c;
  if (malformed > 0) {
    console.warn(
      `[Migrations] 013: ${malformed} entity row(s) contain malformed JSON; skipping json_extract indexes. ` +
        `Clean up the data and re-create these indexes manually to enable them.`,
    );
    return;
  }
  for (const stmt of INDEX_STATEMENTS) db.exec(stmt);
}

function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_entities_type_status;
    DROP INDEX IF EXISTS idx_entities_type_due_date;
    DROP INDEX IF EXISTS idx_entities_type_proposal_status;
    DROP INDEX IF EXISTS idx_entities_type_client_id;
    DROP INDEX IF EXISTS idx_entities_type_approval_status;
  `);
}

module.exports = { up, down };
