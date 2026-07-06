export function sanitizeFilename(original) {
  return original.replace(/\.\./g, '').replace(/[/\\]/g, '_').replace(/[^\w.\-\u00C0-\u024F]/g, '_').slice(0, 100);
}
