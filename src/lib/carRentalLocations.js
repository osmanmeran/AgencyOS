// Fixed set of car rental pickup/drop-off locations — a picklist rather than
// free text (as it was before) so pickup vs drop-off comparisons, which
// drive the drop-off surcharge, are always exact string matches instead of
// depending on staff typing the same location name identically every time.
// Staff assign the subset a given supplier actually operates at
// (SupplierDetails.jsx); clients then only see locations that are both in
// this list AND assigned to at least one available car rental supplier.
export const CAR_RENTAL_LOCATIONS = [
  'Istanbul (IST) Airport',
  'Istanbul (SAW) Sabiha Gökçen Airport',
  'Kayseri (ASR) Airport',
  'Nevşehir (NAV) Airport',
  'Bodrum (BJV) Airport',
  'Antalya (AYT) Airport',
  'Izmir (ADB) Airport',
  'Dalaman (DLM) Airport',
];
