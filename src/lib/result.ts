import type { PiIndex } from './index/reader';
import { deepest, type StairRow } from './staircase';

export const STRIP_CONTEXT = 24;

export interface Strip {
  k: number;
  before: string;
  match: string;
  after: string;
  /** One-based position of the match. */
  position: number;
}

export interface ResultModel {
  rows: StairRow[];
  strips: Strip[];
  /** The row whose strip is shown first. */
  selected: StairRow | undefined;
  totalDigits: number;
  maxQuery: number;
}

/** Picks the row named by the URL when it was found, otherwise the deepest found row. */
export function selectRow(rows: StairRow[], requested: number | undefined): StairRow | undefined {
  if (requested !== undefined) {
    const r = rows.find((row) => row.k === requested);
    if (r && r.first !== null) return r;
  }
  return deepest(rows);
}

export async function buildStrips(index: PiIndex, rows: readonly StairRow[]): Promise<Strip[]> {
  const found = rows.filter((r) => r.first !== null);
  return Promise.all(
    found.map(async (r) => {
      const position = r.first as number;
      const start = Math.max(0, position - 1 - STRIP_CONTEXT);
      const length = position - 1 - start + r.digits.length + STRIP_CONTEXT;
      const digits = await index.digitsAt(start, length);
      const text = digits.join('');
      const offset = position - 1 - start;
      return {
        k: r.k,
        before: text.slice(0, offset),
        match: text.slice(offset, offset + r.digits.length),
        after: text.slice(offset + r.digits.length),
        position,
      };
    }),
  );
}

export async function buildResult(
  index: PiIndex,
  rows: StairRow[],
  requested: number | undefined,
): Promise<ResultModel> {
  const strips = await buildStrips(index, rows);
  return {
    rows,
    strips,
    selected: selectRow(rows, requested),
    totalDigits: index.manifest.digits,
    maxQuery: index.manifest.maxQuery,
  };
}

export function parseRequestedK(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  return /^\d{1,2}$/.test(raw) ? Number(raw) : undefined;
}
