/**
 * Reads the double-submit CSRF cookie set by setTokenCookie() on login.
 * Callers echo the value back as the X-CSRF-Token header on mutating
 * requests; server/middleware/csrf.js checks the two match.
 */
export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
