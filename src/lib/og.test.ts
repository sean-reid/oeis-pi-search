import { describe, expect, it } from 'vitest';
import { headline, ogHtml } from './og-html';

const rows = [
  { k: 1, digits: '0', first: 32, count: 1954 },
  { k: 2, digits: '01', first: 167, count: 217 },
  { k: 3, digits: '011', first: null, count: 0 },
];

describe('og', () => {
  it('writes the headline for the deepest found row', () => {
    expect(headline(rows, 20000)).toBe('The first 2 terms appear at position 167');
    expect(headline([rows[2]], 20000)).toBe('Not in the first 20,000 digits of pi');
    expect(headline([rows[0]], 20000)).toBe('The first term appears at position 32');
  });

  it('escapes the title and lists rows', () => {
    const html = ogHtml({ eyebrow: 'A000045', title: 'a < b & "c"', rows, totalDigits: 20000 });
    expect(html).toContain('a &lt; b &amp; &quot;c&quot;');
    expect(html).toContain('not found');
    expect(html).toContain('>167<');
  });
});
