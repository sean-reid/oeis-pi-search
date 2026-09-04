import type { StairRow } from './staircase';

export interface SequenceRecord {
  anumber: string;
  name: string;
  terms: string[];
  staircase: StairRow[];
  hasNegative: boolean;
}

interface Row {
  anumber: string;
  name: string;
  terms: string;
  staircase: string;
  has_negative: number;
}

function toRecord(r: Row): SequenceRecord {
  return {
    anumber: r.anumber,
    name: r.name,
    terms: r.terms.split(','),
    staircase: JSON.parse(r.staircase) as StairRow[],
    hasNegative: r.has_negative === 1,
  };
}

const COLUMNS = 'anumber, name, terms, staircase, has_negative';

export async function getSequence(db: D1Database, anumber: string): Promise<SequenceRecord | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM sequences WHERE anumber = ?`)
    .bind(anumber)
    .first<Row>();
  return row ? toRecord(row) : null;
}

export interface NameMatch {
  anumber: string;
  name: string;
}

/** Turns free text into an FTS5 prefix query: every word must match as a prefix. */
export function ftsQuery(text: string): string | null {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (words.length === 0) return null;
  return words.map((w) => `"${w}"*`).join(' ');
}

export async function searchNames(db: D1Database, text: string, limit = 10): Promise<NameMatch[]> {
  const q = ftsQuery(text);
  if (!q) return [];
  const { results } = await db
    .prepare(
      'SELECT anumber, name FROM names_fts WHERE names_fts MATCH ? ORDER BY rank, anumber LIMIT ?',
    )
    .bind(q, limit)
    .all<NameMatch>();
  return results;
}

export async function getMeta(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db
    .prepare('SELECT key, value FROM meta')
    .all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}
