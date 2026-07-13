// Shared guided-tour pricing/discount-window logic used by both the client
// portal home (ClientPortal.jsx) and the quote builder's tour picker
// (ClientQuoteBuilder.jsx) — kept in one place so a change to tier selection
// or discount-window rules can't drift between the two.

/** Local YYYY-MM-DD for "today" (matches the YYYY-MM-DD stored on offer start/end dates). */
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lowest per-person price from a tour's pricing tiers, or null if none. */
export function tourStartingPrice(tour) {
  const tiers = Array.isArray(tour?.pricingTiers) ? tour.pricingTiers : [];
  if (!tiers.length) return null;
  const prices = tiers.map((tier) => Number(tier.price) || 0).filter((p) => p > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}

/** Active special offer for a tour today, or null. */
export function activeDiscount(tour) {
  const offer = tour?.specialOffer;
  const percent = Number(offer?.percent) || 0;
  if (percent <= 0) return null;
  const base = tourStartingPrice(tour);
  if (base == null) return null;
  const today = todayYmd();
  if (offer.startDate && today < offer.startDate) return null;
  if (offer.endDate && today > offer.endDate) return null;
  const discounted = Math.round(base * (1 - percent / 100) * 100) / 100;
  return { percent, base, discounted };
}

/**
 * Per-person price for a given number of participants, selected from the
 * tour's pricing tiers by matching `minParticipants`/`maxParticipants`.
 * If no tier contains `pax` exactly, the next higher bracket is used (round
 * up); if `pax` is 0/null the cheapest tier is returned. Returns null when the
 * tour has no priced tiers.
 */
export function tourPriceForPax(tour, pax) {
  const tiers = Array.isArray(tour?.pricingTiers) ? tour.pricingTiers : [];
  if (!tiers.length) return null;
  const valid = tiers.filter((t) => Number(t.price) > 0);
  if (!valid.length) return null;
  const sorted = [...valid].sort((a, b) => Number(a.minParticipants || 0) - Number(b.minParticipants || 0));
  const n = Number(pax) || 0;
  if (n > 0) {
    const exact = sorted.find((t) => n >= Number(t.minParticipants || 0) && n <= Number(t.maxParticipants || Infinity));
    if (exact) return Number(exact.price);
    const up = sorted.find((t) => Number(t.minParticipants || 0) >= n);
    if (up) return Number(up.price);
  }
  return Number(sorted[0].price);
}
