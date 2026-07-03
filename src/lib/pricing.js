// Selling-price convention for the agency: take a base (acquiring) price,
// apply a percentage markup, and round the result UP to the nearest 0.10.
//
// Floating-point makes the naive `Math.ceil(raw * 10) / 10` wrong in two ways:
// 100 * 1.1 === 110.00000000000001 (ceils up to 110.1), and even a clean 111.1
// becomes 1111.0000000000002 when multiplied by 10 (ceils up to 111.2). So we
// scale to tenths and strip the noise with Math.round BEFORE the ceil. This is
// the single source of truth for markup rounding across proposals,
// reservations, and the B2B catalog; the backend mirrors it in
// server/routes/b2b.js (roundSellPrice).
export function applyMarkup(price, markupPct = 0) {
  const base = parseFloat(price) || 0;
  const raw = base * (1 + (markupPct || 0) / 100);
  return Math.ceil(Math.round(raw * 10 * 1e6) / 1e6) / 10;
}
