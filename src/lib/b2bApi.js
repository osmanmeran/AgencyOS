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

export function submitQuote({ title, items, notes }) {
  return apiFetch('/quote', { method: 'POST', body: JSON.stringify({ title, items, notes }) });
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
