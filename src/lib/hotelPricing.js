// Shared hotel/lodging rate-matching and pricing helpers, used by both the
// staff-style dropdown quote builder (ClientQuoteBuilder.jsx) and the
// guided B2C hotel search wizard (ClientHotelSearch.jsx), so both flows
// resolve identical rates for identical inputs.

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

export const MEAL_TREATMENT_CODES = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'];

export const MEAL_TREATMENT_I18N_KEYS = {
  RO: 'supplierPricingManager.mealRO',
  BB: 'supplierPricingManager.mealBB',
  HB: 'supplierPricingManager.mealHB',
  FB: 'supplierPricingManager.mealFB',
  AI: 'supplierPricingManager.mealAI',
  UAI: 'supplierPricingManager.mealUAI',
};

export const locationOf = (item) => item.city || item.area || 'Other';

export function isLodgingCategory(name) {
  const c = (name || '').toLowerCase();
  return c.includes('hotel') || c.includes('lodging') || c.includes('accommodation') || c.includes('resort');
}

// A rate is usable for a given check-in date if it's an all-year rate, or a
// 'custom' season whose date range contains it. high_season/low_season/peak
// carry no stored date range in the DB (season_start/season_end are only
// entered for 'custom' — see SupplierPricingManager.jsx) so they can never be
// auto-matched; they fall through to the ambiguous case in resolveRoomRate.
export function isRateValidOn(rate, date) {
  if (rate.season_type === 'all_year') return true;
  if (!date) return false;
  if (rate.season_type === 'custom')
    return !!rate.season_start && !!rate.season_end && date >= rate.season_start && date <= rate.season_end;
  return false;
}

// Range-aware version of isRateValidOn, for a multi-night stay: a 'custom'
// season rate only matches if BOTH the check-in and check-out dates fall
// within its window (checking only the check-in date, as isRateValidOn does,
// would wrongly match a rate whose season ends mid-stay).
export function isRateValidForRange(rate, startDate, endDate) {
  if (rate.season_type === 'all_year') return true;
  if (!startDate || !endDate) return false;
  if (rate.season_type === 'custom')
    return !!rate.season_start && !!rate.season_end && startDate >= rate.season_start && endDate <= rate.season_end;
  return false;
}

// Given every rate tier for a supplier + room type, pick the one that
// actually applies to the requested check-in date. If exactly one candidate
// exists it's used regardless of date (nothing to disambiguate). Otherwise a
// rate is only auto-selected when the date narrows it down to exactly one
// match; anything else (no date yet, an undated season label alongside an
// all-year rate, overlapping custom ranges) is left for the client to
// resolve manually from the returned candidate list.
export function resolveRoomRate(candidates, date) {
  if (candidates.length === 0) return { rate: null, candidates: [] };
  if (candidates.length === 1) return { rate: candidates[0], candidates };
  const valid = date ? candidates.filter((r) => isRateValidOn(r, date)) : [];
  if (valid.length === 1) return { rate: valid[0], candidates };
  return { rate: null, candidates: valid.length > 0 ? valid : candidates };
}

// Range-aware sibling of resolveRoomRate: returns every candidate valid for
// the whole stay, rather than auto-picking one — used by the hotel search
// wizard's Results step, which shows a list of matches instead of a single
// disambiguated line.
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

// Pre-selects a conventional occupancy for a given passenger count — a
// suggestion only, never a filter: there is no stored occupancy->pax mapping
// in the data (min_quantity/max_quantity bound room quantity, not pax), so
// the client can always override it.
export function suggestOccupancyForPax(pax) {
  const typeMap = { 1: 'single', 2: 'double', 3: 'triple', 4: 'quad' };
  return typeMap[pax] || 'family';
}
