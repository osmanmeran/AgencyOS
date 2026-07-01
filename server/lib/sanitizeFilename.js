export function sanitizeFilename(original) {
  return original.replace(/\.\./g, '').replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}
