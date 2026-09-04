import { describe, expect, it } from 'vitest';
import { parseRequestedK, selectRow } from './result';
import type { StairRow } from './staircase';

const rows: StairRow[] = [
  { k: 1, digits: '1', first: 1, count: 10 },
  { k: 2, digits: '14', first: 1, count: 5 },
  { k: 3, digits: '141', first: null, count: 0 },
];

describe('selectRow', () => {
  it('prefers the requested row when it was found', () => {
    expect(selectRow(rows, 1)?.k).toBe(1);
  });
  it('falls back to the deepest found row', () => {
    expect(selectRow(rows, 3)?.k).toBe(2);
    expect(selectRow(rows, undefined)?.k).toBe(2);
    expect(selectRow([rows[2]], undefined)).toBeUndefined();
  });
});

describe('parseRequestedK', () => {
  it('accepts one or two digits only', () => {
    expect(parseRequestedK('7')).toBe(7);
    expect(parseRequestedK('12')).toBe(12);
    expect(parseRequestedK('x')).toBeUndefined();
    expect(parseRequestedK(undefined)).toBeUndefined();
  });
});
