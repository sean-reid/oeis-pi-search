import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PiIndex, type RangeSource } from './index/reader';
import { deepest, prefixes, staircase } from './staircase';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'index', 'fixtures');
const source: RangeSource = {
  async read(object, offset, length) {
    const all = await readFile(join(fixtures, object));
    return new Uint8Array(all.subarray(offset, offset + length));
  },
};

describe('prefixes', () => {
  it('concatenates, drops signs, and stops past the cap', () => {
    expect(prefixes(['0', '1', '1', '2'], 12)).toEqual(['0', '01', '011', '0112']);
    expect(prefixes(['1', '-1', '2'], 12)).toEqual(['1', '11', '112']);
    expect(prefixes(['123', '4567', '89012', '3'], 12)).toEqual(['123', '1234567', '123456789012']);
    expect(prefixes(['1234567890123'], 12)).toEqual([]);
  });
});

describe('staircase', () => {
  it('matches the rows the rust tool wrote into the e2e seed', async () => {
    const index = await PiIndex.open(source);
    const rows = await staircase(index, ['0', '1', '1', '2', '3', '5', '8', '13']);
    expect(rows).toEqual([
      { k: 1, digits: '0', first: 32, count: 1954 },
      { k: 2, digits: '01', first: 167, count: 217 },
      { k: 3, digits: '011', first: 361, count: 25 },
      { k: 4, digits: '0112', first: 4448, count: 5 },
      { k: 5, digits: '01123', first: 7143, count: 1 },
      { k: 6, digits: '011235', first: null, count: 0 },
      { k: 7, digits: '0112358', first: null, count: 0 },
    ]);
    expect(deepest(rows)?.k).toBe(5);
    expect(deepest([])).toBeUndefined();
  });
});
