import { describe, expect, it } from 'vitest';
import { describeInput } from './suggest';

describe('describeInput', () => {
  it('describes A-numbers, digits, and terms', () => {
    expect(describeInput('a45', 12)).toEqual({
      label: 'A000045',
      detail: 'Open this sequence',
      href: '/A000045',
    });
    expect(describeInput('31415', 12)?.href).toBe('/digits/31415');
    expect(describeInput('1234567890123', 12)).toMatchObject({
      href: '/digits/123456789012',
      detail: 'Only the first 12 digits can be searched',
    });
    expect(describeInput('1, -1, 2', 12)).toEqual({
      label: '1, -1, 2',
      detail: 'Search for 112',
      href: '/terms/1,-1,2',
    });
  });

  it('returns null for names and empty input', () => {
    expect(describeInput('Fibonacci', 12)).toBeNull();
    expect(describeInput('  ', 12)).toBeNull();
  });
});
