import { describe, expect, it } from 'vitest';
import { ftsQuery } from './db';

describe('ftsQuery', () => {
  it('quotes each word as a prefix', () => {
    expect(ftsQuery('Fibonacci')).toBe('"fibonacci"*');
    expect(ftsQuery('powers of 2')).toBe('"powers"* "of"* "2"*');
    expect(ftsQuery("Recaman's")).toBe('"recaman"* "s"*');
  });

  it('returns null for nothing searchable', () => {
    expect(ftsQuery('  ,,  ')).toBeNull();
  });
});
