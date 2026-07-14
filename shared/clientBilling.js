// Company -> Client billing inheritance.
//
// A Client can belong to a Company (client.company_id). The Company holds the
// *shared* billing defaults for all its contacts: default markup %, preferred
// currency, and invoice details (tax ID, invoice address, payment method). A
// contact may override any of these on its own Client record.
//
// `effectiveClientBilling(client, company)` returns the client with each
// billing field resolved as "client value if set, otherwise the company's".
// This is the single source of truth both the server (b2b pricing) and the
// frontend (portal currency, invoice display) use, so linking a client to a
// company automatically applies that company's markup / currency / invoice
// details to the client without copying data onto the Client record.

export const CLIENT_BILLING_FIELDS = [
  'default_markup',
  'preferred_currency',
  'tax_id',
  'invoice_address',
  'payment_method',
];

function hasValue(v) {
  if (v === undefined || v === null || v === '') return false;
  if (typeof v === 'number' && Number.isNaN(v)) return false;
  return true;
}

// default_markup is special: the pricing code has always read it as
// `client.default_markup || 0`, so a stored 0 has never been a meaningful
// override — treat 0/absent as "not set" so the client inherits the company's
// markup. Every other field uses plain "is it set?".
function clientHasOwn(field, value) {
  if (field === 'default_markup') return hasValue(value) && Number(value) !== 0;
  return hasValue(value);
}

/**
 * Merge a company's billing defaults into a client. Non-billing client fields
 * are untouched; the returned object is a shallow copy (inputs not mutated).
 * @param {Record<string, any> | null | undefined} client
 * @param {Record<string, any> | null | undefined} company
 * @returns {Record<string, any>}
 */
export function effectiveClientBilling(client, company) {
  const out = { ...(client || {}) };
  if (!company) return out;
  for (const field of CLIENT_BILLING_FIELDS) {
    if (!clientHasOwn(field, out[field]) && hasValue(company[field])) {
      out[field] = company[field];
    }
  }
  return out;
}
