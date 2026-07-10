import { describe, it, expect } from 'vitest';
import { applyMarkup, resolvePaxTier } from '../../src/lib/pricing.js';
import {
  resolvePaxTier as serverResolvePaxTier,
  computeUnitPrice as serverComputeUnitPrice,
} from '../../server/routes/b2b.js';

describe('applyMarkup', () => {
  it('does not bump an exact result up by 0.1 (floating-point artifact)', () => {
    // 100 * 1.1 === 110.00000000000001 in JS — must stay 110, not 110.1
    expect(applyMarkup(100, 10)).toBe(110);
    expect(applyMarkup(200, 10)).toBe(220);
    expect(applyMarkup(50, 10)).toBe(55);
  });

  it('still rounds genuine fractions UP to the nearest 0.10', () => {
    expect(applyMarkup(100.5, 10)).toBe(110.6); // 110.55 -> 110.6
    expect(applyMarkup(101, 10)).toBe(111.1); // 111.1 exact
    expect(applyMarkup(33.33, 10)).toBe(36.7); // 36.663 -> 36.7
  });

  it('returns the base unchanged at 0% markup', () => {
    expect(applyMarkup(110, 0)).toBe(110);
    expect(applyMarkup(99.9, 0)).toBe(99.9);
  });

  it('handles string prices and missing markup', () => {
    expect(applyMarkup('100', 10)).toBe(110);
    expect(applyMarkup('100')).toBe(100);
  });

  it('treats invalid input as 0', () => {
    expect(applyMarkup(undefined, 10)).toBe(0);
    expect(applyMarkup('abc', 10)).toBe(0);
  });
});

describe('resolvePaxTier', () => {
  // 2 pax → 210, 3 pax → 175, 4+ → 160 (the guided-tour use case)
  const pricing = {
    base_price: 250,
    pax_tiers: [
      { min_pax: 2, max_pax: 2, price_per_person: 210 },
      { min_pax: 3, max_pax: 3, price_per_person: 175 },
      { min_pax: 4, max_pax: null, price_per_person: 160 },
    ],
  };

  it('picks the band covering the participant count', () => {
    expect(resolvePaxTier(pricing, 2)?.price_per_person).toBe(210);
    expect(resolvePaxTier(pricing, 3)?.price_per_person).toBe(175);
  });

  it('treats an empty max_pax as unlimited', () => {
    expect(resolvePaxTier(pricing, 4)?.price_per_person).toBe(160);
    expect(resolvePaxTier(pricing, 40)?.price_per_person).toBe(160);
    expect(
      resolvePaxTier({ pax_tiers: [{ min_pax: 2, max_pax: '', price_per_person: 99 }] }, 9)?.price_per_person,
    ).toBe(99);
  });

  it('returns null when no band matches (caller falls back to base_price)', () => {
    expect(resolvePaxTier(pricing, 1)).toBeNull();
    expect(resolvePaxTier({ base_price: 50 }, 3)).toBeNull();
    expect(resolvePaxTier({ pax_tiers: [] }, 3)).toBeNull();
    expect(resolvePaxTier(null, 3)).toBeNull();
  });

  it('ignores malformed bands without a min_pax', () => {
    expect(resolvePaxTier({ pax_tiers: [{ max_pax: 5, price_per_person: 99 }] }, 3)).toBeNull();
    expect(resolvePaxTier({ pax_tiers: [{ min_pax: '', price_per_person: 99 }] }, 3)).toBeNull();
  });

  it('handles string numbers as stored by forms', () => {
    const p = { pax_tiers: [{ min_pax: '2', max_pax: '4', price_per_person: '210' }] };
    expect(resolvePaxTier(p, 3)?.price_per_person).toBe('210');
    expect(resolvePaxTier(p, '3')?.price_per_person).toBe('210');
  });

  it('server mirror agrees with the frontend implementation', () => {
    for (const pax of [1, 2, 3, 4, 10]) {
      expect(serverResolvePaxTier(pricing, pax)).toEqual(resolvePaxTier(pricing, pax));
    }
  });
});

describe('computeUnitPrice (b2b) with pax tiers', () => {
  const pricing = {
    base_price: 100,
    client_price: null,
    pax_tiers: [
      { min_pax: 2, max_pax: 2, price_per_person: 210 },
      { min_pax: 3, max_pax: null, price_per_person: 175, client_price_per_person: 180 },
    ],
  };

  it('applies markup to the matching band cost', () => {
    expect(serverComputeUnitPrice(pricing, 10, 2)).toBe(231); // 210 * 1.1
  });

  it('a band sell override wins over markup', () => {
    expect(serverComputeUnitPrice(pricing, 10, 3)).toBe(180);
  });

  it('falls back to the flat base price when no band matches or pax is unknown', () => {
    expect(serverComputeUnitPrice(pricing, 10, 1)).toBe(110);
    expect(serverComputeUnitPrice(pricing, 10)).toBe(110);
  });
});
