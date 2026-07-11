// Shared hotel/lodging rate-matching and pricing helpers used by
// ClientQuoteBuilder.jsx's service picker (the "Choose a service" dialog's
// guided flow for the Hotel category) and HotelResultCard.jsx.

export const OCCUPANCY_LABELS = {
  single: 'Single',
  double: 'Double',
  twin: 'Twin',
  triple: 'Triple',
  quad: 'Quad',
  family: 'Family',
  extra_bed: 'Extra bed',
};

// i18n key suffixes matching SupplierPricingManager.jsx's OCCUPANCY_OPTION_KEYS
// / MEAL_TREATMENT_OPTION_KEYS (all under the 'supplierPricingManager.*'
// namespace, already translated in all 6 locales) — reused here instead of
// duplicating a second set of translated strings for the same enums.
export const OCCUPANCY_I18N_KEYS = {
  single: 'supplierPricingManager.occSingle',
  double: 'supplierPricingManager.occDouble',
  twin: 'supplierPricingManager.occTwin',
  triple: 'supplierPricingManager.occTriple',
  quad: 'supplierPricingManager.occQuad',
  family: 'supplierPricingManager.occFamily',
  extra_bed: 'supplierPricingManager.occExtraBed',
};

export const MEAL_TREATMENT_I18N_KEYS = {
  RO: 'supplierPricingManager.mealRO',
  BB: 'supplierPricingManager.mealBB',
  HB: 'supplierPricingManager.mealHB',
  FB: 'supplierPricingManager.mealFB',
  AI: 'supplierPricingManager.mealAI',
  UAI: 'supplierPricingManager.mealUAI',
};

export const locationOf = (item) => item.city || item.area || 'Other';

// Derives which occupancy tier to search for from the number of adults in a
// room — authoritative (drives which SupplierPricing rows match), not just a
// pre-fill suggestion. Children ride along as a separate per-child supplement
// rather than affecting this tier.
export function occupancyForAdults(adults) {
  const map = { 1: 'single', 2: 'double', 3: 'triple', 4: 'quad' };
  return map[adults] || 'family';
}

export function isLodgingCategory(name) {
  const c = (name || '').toLowerCase();
  return c.includes('hotel') || c.includes('lodging') || c.includes('accommodation') || c.includes('resort');
}

// A 'custom' season rate only matches a stay if BOTH the check-in and
// check-out dates fall within its window (checking only the check-in date
// would wrongly match a rate whose season ends mid-stay). all_year rates
// always match; high_season/low_season/peak carry no stored date range in
// the DB (season_start/season_end are only entered for 'custom' — see
// SupplierPricingManager.jsx) so they can never be auto-matched.
export function isRateValidForRange(rate, startDate, endDate) {
  if (rate.season_type === 'all_year') return true;
  if (!startDate || !endDate) return false;
  if (rate.season_type === 'custom')
    return !!rate.season_start && !!rate.season_end && startDate >= rate.season_start && endDate <= rate.season_end;
  return false;
}

// Every candidate valid for the whole stay — the service picker shows all of
// them as selectable results rather than auto-picking one.
export function resolveRoomRatesForRange(candidates, startDate, endDate) {
  if (!candidates.length) return [];
  if (!startDate || !endDate) return candidates;
  return candidates.filter((r) => isRateValidForRange(r, startDate, endDate));
}

export function nightsBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 86400000);
}

// Sell price per unit for a catalog service. Guided-tour services can carry
// per-pax sell bands (pax_tiers, priced server-side with the client's markup);
// the band covering the line's participant count wins over the flat unit_price.
export function unitPriceFor(svc, quantity) {
  const tiers = svc?.pax_tiers;
  if (Array.isArray(tiers) && tiers.length) {
    const q = Math.max(1, Math.round(Number(quantity) || 1));
    const band = tiers.find((t) => {
      if (t.min_pax == null || t.min_pax === '') return false;
      const min = Number(t.min_pax);
      if (!Number.isFinite(min)) return false;
      const max = t.max_pax != null && t.max_pax !== '' ? Number(t.max_pax) : Infinity;
      return q >= min && q <= max;
    });
    if (band) return band.unit_price || 0;
  }
  return svc?.unit_price || 0;
}
