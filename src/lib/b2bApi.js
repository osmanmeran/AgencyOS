async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch('/api/b2b' + path, { ...opts, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  return data;
}

export function getCatalog() {
  return apiFetch('/catalog');
}

export function getFeatured() {
  return apiFetch('/featured');
}

export function getStorefront() {
  return apiFetch('/storefront');
}

export function getSupplierCatalog(id) {
  return apiFetch(`/suppliers/${id}`);
}

// Accepts the simple cart shape ({ title, items, notes }) as well as the
// richer reservation-style builder payload (destination, dates, passengers,
// and per-item trip details). The server ignores unknown fields.
export function submitQuote(payload) {
  return apiFetch('/quote', { method: 'POST', body: JSON.stringify(payload) });
}

export function listQuotes() {
  return apiFetch('/quotes');
}

export function getQuote(id) {
  return apiFetch(`/quotes/${id}`);
}

export function respondToQuote(id, { status, response_notes }) {
  return apiFetch(`/quotes/${id}/respond`, { method: 'PUT', body: JSON.stringify({ status, response_notes }) });
}
