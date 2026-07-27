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

/**
 * Props for an <img> whose src is a stored asset. /uploads is authenticated
 * (session cookie) since it may serve one workspace's private documents, so on
 * a split-host deploy the image request has to carry credentials — that needs
 * `crossorigin="use-credentials"`. Harmless same-origin, where the attribute
 * has no effect on whether the cookie is sent.
 */
export function assetImgProps(url) {
  const src = assetUrl(url);
  return BACKEND_URL && typeof src === 'string' && src.startsWith(BACKEND_URL.replace(/\/+$/, ''))
    ? { src, crossOrigin: /** @type {const} */ ('use-credentials') }
    : { src };
}
