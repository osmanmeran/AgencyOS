// A supplier can be put in "stop sales" for one or more date ranges — no new
// booking against that supplier should be creatable for dates inside any of
// them, across every place a supplier + date gets picked (staff reservations,
// itinerary, quick bookings, the client B2B portal).

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// Returns the first stop sale for `supplierId` that overlaps [startDate, endDate]
// (a single date can be passed as both), or null if the supplier is bookable.
export function getBlockingStopSale(stopSales, supplierId, startDate, endDate) {
  if (!supplierId || !startDate) return null;
  const end = endDate || startDate;
  return (
    (stopSales || []).find((s) => s.supplier_id === supplierId && overlaps(startDate, end, s.start_date, s.end_date)) ||
    null
  );
}

export function isSupplierInStopSaleToday(stopSales, supplierId) {
  const today = new Date().toISOString().split('T')[0];
  return !!getBlockingStopSale(stopSales, supplierId, today, today);
}
