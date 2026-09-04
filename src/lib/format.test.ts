import { describe, expect, it } from 'vitest';
import { canonicalAnumber, formatNumber, pluralTerms } from './format';

describe('format helpers', () => {
  it('canonicalises A-numbers', () => {
    expect(canonicalAnumber('a45')).toBe('A000045');
    expect(canonicalAnumber('A000045')).toBe('A000045');
    expect(canonicalAnumber('A1234567')).toBeNull();
    expect(canonicalAnumber('fib')).toBeNull();
  });

  it('formats with separators and pluralises', () => {
    expect(formatNumber(4253057)).toBe('4,253,057');
    expect(pluralTerms(1)).toBe('the first term');
    expect(pluralTerms(7)).toBe('the first 7 terms');
  });
});
