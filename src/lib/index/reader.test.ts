import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeNext, parseDigits, PiIndex, unpackDigits, type RangeSource } from './reader';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const fileSource: RangeSource = {
  async read(file, offset, length) {
    const all = await readFile(join(fixtures, file));
    return new Uint8Array(all.subarray(offset, offset + length));
  },
};

function scan(haystack: number[], needle: number[]) {
  let first: number | null = null;
  let count = 0;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    count++;
    if (first === null) first = i;
  }
  return { first, count };
}

async function allDigits(index: PiIndex) {
  return index.digitsAt(0, index.manifest.digits);
}

describe('PiIndex over the committed fixture', () => {
  it('reads the manifest', async () => {
    const index = await PiIndex.open(fileSource);
    expect(index.manifest).toMatchObject({ version: 1, digits: 20000, tableMax: 3, maxQuery: 7 });
  });

  it('decodes the first digits of pi', async () => {
    const index = await PiIndex.open(fileSource);
    const d = await index.digitsAt(0, 20);
    expect(d.join('')).toBe('14159265358979323846');
    expect(await index.digitsAt(19995, 20)).toHaveLength(5);
    expect(await index.digitsAt(20000, 5)).toEqual([]);
  });

  it('agrees with a naive scan for every query length', async () => {
    const index = await PiIndex.open(fileSource);
    const digits = await allDigits(index);
    let x = 12345;
    const next = () => (x = (x * 1103515245 + 12345) % 2147483648);
    for (let i = 0; i < 1500; i++) {
      const len = 1 + (next() % 7);
      const start = next() % digits.length;
      const needle =
        next() % 5 === 0
          ? Array.from({ length: len }, () => next() % 10)
          : digits.slice(start, Math.min(start + len, digits.length));
      if (needle.length === 0) continue;
      expect(await index.lookup(needle), needle.join('')).toEqual(scan(digits, needle));
    }
  });

  it('finds strings at the very end where next digits are partial', async () => {
    const index = await PiIndex.open(fileSource);
    const digits = await allDigits(index);
    for (const len of [4, 5, 6, 7]) {
      const needle = digits.slice(-len);
      const hit = await index.lookup(needle);
      expect(hit).toEqual(scan(digits, needle));
      expect(hit.count).toBeGreaterThanOrEqual(1);
    }
  });

  it('rejects out of range query lengths', async () => {
    const index = await PiIndex.open(fileSource);
    await expect(index.lookup([])).rejects.toThrow(RangeError);
    await expect(index.lookup([1, 2, 3, 4, 5, 6, 7, 8])).rejects.toThrow(RangeError);
  });
});

describe('helpers', () => {
  it('parses digit strings only', () => {
    expect(parseDigits('0123')).toEqual([0, 1, 2, 3]);
    expect(parseDigits('12a')).toBeNull();
  });

  it('decodes the next-digit encoding', () => {
    expect(decodeNext(0)).toEqual({ avail: 4, digits: [0, 0, 0, 0] });
    expect(decodeNext(9999)).toEqual({ avail: 4, digits: [9, 9, 9, 9] });
    expect(decodeNext(10007)).toEqual({ avail: 3, digits: [0, 0, 7] });
    expect(decodeNext(11042)).toEqual({ avail: 2, digits: [4, 2] });
    expect(decodeNext(11100)).toEqual({ avail: 1, digits: [0] });
    expect(decodeNext(11110)).toEqual({ avail: 0, digits: [] });
  });

  it('unpacks nibbles from an offset', () => {
    expect(unpackDigits(new Uint8Array([0x14, 0x15, 0x92]), 1, 4)).toEqual([4, 1, 5, 9]);
  });
});
