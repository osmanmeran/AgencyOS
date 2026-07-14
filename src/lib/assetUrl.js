// Resolve a stored asset URL (e.g. an uploaded logo at /uploads/...) to an
// absolute URL. Uploads are served by the Express backend; when the frontend
// is hosted separately (e.g. a static host in front of the API), a relative
// /uploads path resolves against the frontend origin and 404s. Prefix it with
// the configured backend origin (VITE_MARVELOPS_BACKEND_URL) so it loads.
// Falls back to the current origin when the var is unset (same-origin deploy).
const BACKEND_URL = import.meta.env.VITE_MARVELOPS_BACKEND_URL || '';

export function assetUrl(url) {
  if (!url || typeof url !== 'string') return url;
  // Absolute (http/https), data: or blob: URLs are already usable.
  if (!url.startsWith('/')) return url;
  const base = BACKEND_URL ? BACKEND_URL.replace(/\/+$/, '') : window.location.origin;
  return base + url;
}
