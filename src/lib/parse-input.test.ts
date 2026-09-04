import { describe, expect, it } from 'vitest';
import { concatTerms, normalizeAnumber, parseInput } from './parse-input';

describe('parseInput', () => {
  it('recognises A-numbers in any casing or padding', () => {
    expect(parseInput('A000045')).toEqual({ kind: 'anumber', anumber: 'A000045' });
    expect(parseInput('a45')).toEqual({ kind: 'anumber', anumber: 'A000045' });
    expect(parseInput(' A 45 ')).toEqual({ kind: 'anumber', anumber: 'A000045' });
  });

  it('treats a bare digit string as digits', () => {
    expect(parseInput('31415')).toEqual({ kind: 'digits', digits: '31415' });
    expect(parseInput('000045')).toEqual({ kind: 'digits', digits: '000045' });
  });

  it('treats separated integers as terms', () => {
    expect(parseInput('1, 1, 2, 3, 5')).toEqual({
      kind: 'terms',
      terms: ['1', '1', '2', '3', '5'],
    });
    expect(parseInput('0 1 1 2')).toEqual({ kind: 'terms', terms: ['0', '1', '1', '2'] });
    expect(parseInput('1,-1,2')).toEqual({ kind: 'terms', terms: ['1', '-1', '2'] });
  });

  it('falls back to a name search', () => {
    expect(parseInput('Fibonacci')).toEqual({ kind: 'name', query: 'Fibonacci' });
    expect(parseInput('powers  of 2')).toEqual({ kind: 'name', query: 'powers of 2' });
  });

  it('returns empty for whitespace', () => {
    expect(parseInput('   ')).toEqual({ kind: 'empty' });
  });
});

describe('concatTerms', () => {
  it('joins terms and drops minus signs', () => {
    expect(concatTerms(['0', '1', '1', '2', '3'])).toBe('01123');
    expect(concatTerms(['1', '-1', '2'])).toBe('112');
  });
});

describe('normalizeAnumber', () => {
  it('pads to six digits', () => {
    expect(normalizeAnumber(45)).toBe('A000045');
    expect(normalizeAnumber('123456')).toBe('A123456');
  });
});
