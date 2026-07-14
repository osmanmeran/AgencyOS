// Build a Google Maps search URL for a supplier (or any location string),
// used by the invoice and client itinerary to link out to a map.
export function supplierMapsUrl(supplier) {
  if (!supplier) return '';
  const q = [supplier.name, supplier.address, supplier.city, supplier.area].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}

export function mapsUrlForLocation(location) {
  if (!location) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
