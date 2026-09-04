// Reads the index written by tools/ (see tools/src/format.rs for the layout). Every read is
// a byte range against a named shard so the same code runs over R2 and over the filesystem.

export interface RangeSource {
  read(object: string, offset: number, length: number): Promise<Uint8Array>;
}

export interface Manifest {
  version: number;
  digits: number;
  tableMax: number;
  bucketPrefix: number;
  maxQuery: number;
  shardBytes: number;
  digitsSha256: string;
}

export interface Hit {
  /** Zero-based offset of the first occurrence, or null when absent. */
  first: number | null;
  count: number;
}

export const MANIFEST_FILE = 'index.json';
export const DIGITS_FILE = 'digits.bin';
export const OFFSETS_FILE = 'offsets.bin';
export const BUCKETS_FILE = 'buckets.bin';
const FORMAT_VERSION = 1;
const NONE = 0xffffffff;
const TABLE_ENTRY_BYTES = 8;
const BUCKET_ENTRY_BYTES = 6;

export const tableFile = (k: number) => `table${k}.bin`;
export const shardName = (file: string, shard: number) =>
  `${file}.${String(shard).padStart(3, '0')}`;

/** Splits a byte range into [shard, offsetWithinShard, length] pieces. */
export function shardRanges(
  offset: number,
  length: number,
  shardBytes: number,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  let remaining = length;
  while (remaining > 0) {
    const shard = Math.floor(offset / shardBytes);
    const within = offset - shard * shardBytes;
    const take = Math.min(shardBytes - within, remaining);
    out.push([shard, within, take]);
    offset += take;
    remaining -= take;
  }
  return out;
}

export function parseDigits(s: string): number[] | null {
  if (!/^\d+$/.test(s)) return null;
  return Array.from(s, (c) => c.charCodeAt(0) - 48);
}

export function decodeNext(v: number): { avail: number; digits: number[] } {
  let avail: number;
  let rest: number;
  if (v < 10000) [avail, rest] = [4, v];
  else if (v < 11000) [avail, rest] = [3, v - 10000];
  else if (v < 11100) [avail, rest] = [2, v - 11000];
  else if (v < 11110) [avail, rest] = [1, v - 11100];
  else [avail, rest] = [0, 0];
  const digits = new Array<number>(avail);
  for (let i = avail - 1; i >= 0; i--) {
    digits[i] = rest % 10;
    rest = Math.floor(rest / 10);
  }
  return { avail, digits };
}

function nextMatches(encoded: number, query: number[]): boolean {
  const { avail, digits } = decodeNext(encoded);
  if (query.length > avail) return false;
  for (let i = 0; i < query.length; i++) if (digits[i] !== query[i]) return false;
  return true;
}

function digitsToIndex(digits: number[]): number {
  return digits.reduce((acc, d) => acc * 10 + d, 0);
}

function u32(bytes: Uint8Array, at: number): number {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

function u16(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

export function unpackDigits(bytes: Uint8Array, firstDigit: number, count: number): number[] {
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const d = firstDigit + i;
    const b = bytes[d >> 1];
    out[i] = d & 1 ? b & 0x0f : b >> 4;
  }
  return out;
}

export class PiIndex {
  private constructor(
    private readonly source: RangeSource,
    readonly manifest: Manifest,
  ) {}

  static async open(source: RangeSource, manifest?: Manifest): Promise<PiIndex> {
    if (!manifest) {
      const bytes = await source.read(MANIFEST_FILE, 0, 4096);
      manifest = JSON.parse(new TextDecoder().decode(bytes).replace(/\0+$/, '')) as Manifest;
    }
    if (manifest.version !== FORMAT_VERSION) {
      throw new Error(`index version ${manifest.version} is not ${FORMAT_VERSION}`);
    }
    return new PiIndex(source, manifest);
  }

  private async readRange(file: string, offset: number, length: number): Promise<Uint8Array> {
    const pieces = shardRanges(offset, length, this.manifest.shardBytes);
    const parts = await Promise.all(
      pieces.map(([shard, within, take]) => this.source.read(shardName(file, shard), within, take)),
    );
    if (parts.length === 1) return parts[0];
    const out = new Uint8Array(length);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }

  private async tableEntry(digits: number[]): Promise<{ first: number; count: number }> {
    const idx = digitsToIndex(digits);
    const bytes = await this.readRange(
      tableFile(digits.length),
      idx * TABLE_ENTRY_BYTES,
      TABLE_ENTRY_BYTES,
    );
    return { first: u32(bytes, 0), count: u32(bytes, 4) };
  }

  async lookup(digits: number[]): Promise<Hit> {
    const m = this.manifest;
    if (digits.length === 0 || digits.length > m.maxQuery) {
      throw new RangeError(`query length must be 1..${m.maxQuery}`);
    }
    if (digits.length <= m.tableMax) {
      const e = await this.tableEntry(digits);
      return { first: e.first === NONE ? null : e.first, count: e.count };
    }
    const prefix = digits.slice(0, m.bucketPrefix);
    const rest = digits.slice(m.bucketPrefix);
    const idx = digitsToIndex(prefix);
    const [e, offBytes] = await Promise.all([
      this.tableEntry(prefix),
      this.readRange(OFFSETS_FILE, idx * 4, 4),
    ]);
    if (e.count === 0) return { first: null, count: 0 };
    const off = u32(offBytes, 0);
    const bytes = await this.readRange(
      BUCKETS_FILE,
      off * BUCKET_ENTRY_BYTES,
      e.count * BUCKET_ENTRY_BYTES,
    );
    let first: number | null = null;
    let count = 0;
    for (let at = 0; at + BUCKET_ENTRY_BYTES <= bytes.length; at += BUCKET_ENTRY_BYTES) {
      if (nextMatches(u16(bytes, at + 4), rest)) {
        count++;
        if (first === null) first = u32(bytes, at);
      }
    }
    return { first, count };
  }

  /** Digits from a zero-based offset, clipped to the end of the expansion. */
  async digitsAt(start: number, length: number): Promise<number[]> {
    const n = this.manifest.digits;
    if (start >= n) return [];
    const end = Math.min(start + length, n);
    const byteStart = Math.floor(start / 2);
    const byteEnd = Math.ceil(end / 2);
    const bytes = await this.readRange(DIGITS_FILE, byteStart, byteEnd - byteStart);
    return unpackDigits(bytes, start - byteStart * 2, end - start);
  }
}
