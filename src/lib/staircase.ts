import type { PiIndex } from './index/reader';
import { parseDigits } from './index/reader';

export interface StairRow {
  /** Number of leading terms concatenated. */
  k: number;
  digits: string;
  /** One-based position, or null when absent. */
  first: number | null;
  count: number;
}

/** Mirrors `prefixes` in tools/src/oeis.rs: concatenate terms, drop signs, stop past the cap. */
export function prefixes(terms: readonly string[], maxDigits: number): string[] {
  const out: string[] = [];
  let s = '';
  for (const t of terms) {
    s += t.replace(/^-/, '');
    if (s.length > maxDigits) break;
    out.push(s);
  }
  return out;
}

export async function staircase(index: PiIndex, terms: readonly string[]): Promise<StairRow[]> {
  const rows = prefixes(terms, index.manifest.maxQuery);
  return Promise.all(
    rows.map(async (digits, i) => {
      const d = parseDigits(digits);
      if (!d) throw new Error(`term is not numeric: ${digits}`);
      const hit = await index.lookup(d);
      return {
        k: i + 1,
        digits,
        first: hit.first === null ? null : hit.first + 1,
        count: hit.count,
      };
    }),
  );
}

export function deepest(rows: readonly StairRow[]): StairRow | undefined {
  let best: StairRow | undefined;
  for (const r of rows) if (r.first !== null) best = r;
  return best;
}
