export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EVENT_HANDLER_PATTERN = /^\s*on\w+\s*=\s*/i;
const PROTOCOL_PATTERN = /javascript:|data:|vbscript:/gi;
const SCRIPT_TAG_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_ATTR_PATTERN = /<[^>]+?\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi;

export function sanitizeEmailHtml(html) {
  if (!html) return '';
  return html
    .replace(SCRIPT_TAG_PATTERN, '')
    .replace(EVENT_ATTR_PATTERN, (match) => match.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ''))
    .replace(PROTOCOL_PATTERN, '');
}

export function sanitizeForInnerHtml(dirty) {
  if (!dirty) return '';
  const noScript = dirty.replace(SCRIPT_TAG_PATTERN, '');
  const noEvents = noScript.replace(EVENT_ATTR_PATTERN, (match) => match.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ''));
  const noProtocols = noEvents.replace(PROTOCOL_PATTERN, '');
  return noProtocols;
}
