import { getActAsClientId } from '@/lib/actAsClient';

async function apiFetch(path, opts = {}) {
  // When a staff user is viewing the portal "as" a client, forward the chosen
  // client id so the server can scope read routes to that client. Write routes
  // ignore it and still reject staff, keeping the staff view read-only.
  const asClientId = getActAsClientId();
  if (asClientId) {
    path += (path.includes('?') ? '&' : '?') + 'clientId=' + encodeURIComponent(asClientId);
  }
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch('/api/b2b' + path, { ...opts, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  return data;
}

/** Fetches the B2B service catalog available to the current client. */
export function getCatalog() {
  return apiFetch('/catalog');
}

/**
 * Submits a client-built quote request.
 * @param {object} payload - Reservation-style builder payload: title,
 *   destination, dates, passengers, and per-item trip details. The server
 *   ignores unknown fields.
 */
export function submitQuote(payload) {
  return apiFetch('/quote', { method: 'POST', body: JSON.stringify(payload) });
}

/** Lists quotes submitted by (or visible to) the current client. */
export function listQuotes() {
  return apiFetch('/quotes');
}

/** Fetches a single quote by id. */
export function getQuote(id) {
  return apiFetch(`/quotes/${id}`);
}

/** Accepts or declines a quote, optionally with response notes. */
export function respondToQuote(id, { status, response_notes }) {
  return apiFetch(`/quotes/${id}/respond`, { method: 'PUT', body: JSON.stringify({ status, response_notes }) });
}
