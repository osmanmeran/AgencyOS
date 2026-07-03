// The B2B client catalog only shows SupplierPricing rows with
// approval_status === 'approved', as a review gate for pricing suppliers
// self-submit via their portal. That field was never surfaced in the
// staff-facing Pricing Management UI until now, so every pre-existing price
// tier was stuck at its default ('pending', or unset for older rows) with no
// way to approve it — leaving the entire client-facing catalog empty.
//
// Pre-existing pricing was already relied on for staff-built proposals
// before this gate existed, so treat it as already vetted rather than
// silently blocking every client's catalog after this deploy.
module.exports.up = function (db) {
  const rows = db.prepare("SELECT id, data FROM entities WHERE type = 'SupplierPricing'").all();
  const update = db.prepare('UPDATE entities SET data = ? WHERE id = ?');

  for (const row of rows) {
    const data = JSON.parse(row.data);
    if (data.approval_status !== 'approved' && data.approval_status !== 'rejected') {
      data.approval_status = 'approved';
      update.run(JSON.stringify(data), row.id);
    }
  }
};

module.exports.down = function () {
  // Not meaningfully reversible — approval_status becomes ambiguous once
  // mixed with tiers approved through the normal UI flow afterward.
};
