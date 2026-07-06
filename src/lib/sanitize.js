import DOMPurify from 'dompurify';

/** Escapes `& < > " '` so a string can be safely inserted as HTML text. */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes HTML intended for outgoing emails. Email HTML needs layout
 * tags/attrs (tables, inline styles) that DOMPurify's default profile also
 * allows, so the default config is used here.
 */
export function sanitizeEmailHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html);
}

/** Sanitizes untrusted HTML before rendering it via `dangerouslySetInnerHTML`. */
export function sanitizeForInnerHtml(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty);
}
