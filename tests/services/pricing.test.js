import { describe, it, expect } from 'vitest';
import { applyMarkup } from '../../src/lib/pricing.js';

describe('applyMarkup', () => {
  it('does not bump an exact result up by 0.1 (floating-point artifact)', () => {
    // 100 * 1.1 === 110.00000000000001 in JS — must stay 110, not 110.1
    expect(applyMarkup(100, 10)).toBe(110);
    expect(applyMarkup(200, 10)).toBe(220);
    expect(applyMarkup(50, 10)).toBe(55);
  });

  it('still rounds genuine fractions UP to the nearest 0.10', () => {
    expect(applyMarkup(100.5, 10)).toBe(110.6); // 110.55 -> 110.6
    expect(applyMarkup(101, 10)).toBe(111.1);   // 111.1 exact
    expect(applyMarkup(33.33, 10)).toBe(36.7);  // 36.663 -> 36.7
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
