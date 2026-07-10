/**
 * Selling-price convention for the agency: take a base (acquiring) price,
 * apply a percentage markup, and round the result UP to the nearest 0.10.
 *
 * Floating-point makes the naive `Math.ceil(raw * 10) / 10` wrong in two ways:
 * 100 * 1.1 === 110.00000000000001 (ceils up to 110.1), and even a clean 111.1
 * becomes 1111.0000000000002 when multiplied by 10 (ceils up to 111.2). So we
 * scale to tenths and strip the noise with Math.round BEFORE the ceil. This is
 * the single source of truth for markup rounding across proposals,
 * reservations, and the B2B catalog; the backend mirrors it in
 * `server/routes/b2b.js` (`roundSellPrice`).
 */
export function applyMarkup(price, markupPct = 0) {
  const base = parseFloat(price) || 0;
  const raw = base * (1 + (markupPct || 0) / 100);
  return Math.ceil(Math.round(raw * 10 * 1e6) / 1e6) / 10;
}

/**
 * Per-pax price bands on a SupplierPricing row (`pax_tiers`): for guided
 * tours the per-person price depends on how many people book — e.g.
 * 2 pax → 210, 3 pax → 175, 4+ → 160. Each band is
 * { min_pax, max_pax, price_per_person, client_price_per_person? } where an
 * empty/omitted max_pax means "no upper limit".
 *
 * Returns the band covering `pax`, or null — callers fall back to the row's
 * flat base_price/client_price. Used by the B2B catalog/quote flow
 * (server/routes/b2b.js) and the staff service-line editor.
 */
export function resolvePaxTier(pricing, pax) {
  const tiers = Array.isArray(pricing?.pax_tiers) ? pricing.pax_tiers : [];
  const q = Math.round(Number(pax) || 0);
  return (
    tiers.find((t) => {
      if (t.min_pax == null || t.min_pax === '') return false;
      const min = Number(t.min_pax);
      if (!Number.isFinite(min)) return false;
      const max = t.max_pax != null && t.max_pax !== '' ? Number(t.max_pax) : Infinity;
      return q >= min && q <= max;
    }) || null
  );
}
