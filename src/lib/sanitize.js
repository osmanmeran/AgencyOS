import DOMPurify from 'dompurify';

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Email HTML needs layout tags/attrs (tables, inline styles) that DOMPurify's
// default profile also allows, so the default config is used for both cases.
export function sanitizeEmailHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html);
}

export function sanitizeForInnerHtml(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty);
}
