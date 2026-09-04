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

/** Lowest A-numbers first: the classic sequences were catalogued first, so this beats relevance. */
export async function searchNames(db: D1Database, text: string, limit = 10): Promise<NameMatch[]> {
  const q = ftsQuery(text);
  if (!q) return [];
  const { results } = await db
    .prepare('SELECT anumber, name FROM names_fts WHERE names_fts MATCH ? ORDER BY anumber LIMIT ?')
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

export interface LeaderRow {
  anumber: string;
  name: string;
  depth: number;
  depthDigits: number;
  depthFirst: number | null;
  first8: number | null;
  digits3: number | null;
}

interface LeaderDbRow {
  anumber: string;
  name: string;
  depth: number;
  depth_digits: number;
  depth_first: number | null;
  first8: number | null;
  digits3: number | null;
}

const LEADER_COLUMNS = 'anumber, name, depth, depth_digits, depth_first, first8, digits3';

function toLeader(r: LeaderDbRow): LeaderRow {
  return {
    anumber: r.anumber,
    name: r.name,
    depth: r.depth,
    depthDigits: r.depth_digits,
    depthFirst: r.depth_first,
    first8: r.first8,
    digits3: r.digits3,
  };
}

async function leaders(db: D1Database, where: string, order: string, limit: number) {
  const { results } = await db
    .prepare(`SELECT ${LEADER_COLUMNS} FROM sequences ${where} ORDER BY ${order} LIMIT ?`)
    .bind(limit)
    .all<LeaderDbRow>();
  return results.map(toLeader);
}

/** Most leading terms found, longest digit string first among ties, then earliest. */
export const deepest = (db: D1Database, limit = 25) =>
  leaders(
    db,
    'WHERE depth > 0',
    'depth DESC, depth_digits DESC, depth_first ASC, anumber ASC',
    limit,
  );

/** Eight leading terms found soonest. */
export const earliest = (db: D1Database, limit = 25) =>
  leaders(db, 'WHERE first8 IS NOT NULL', 'first8 ASC, anumber ASC', limit);

/** Three leading terms that never appear, shortest digit string first. */
export const rarest = (db: D1Database, limit = 25) =>
  leaders(db, 'WHERE first3 IS NULL AND digits3 IS NOT NULL', 'digits3 ASC, anumber ASC', limit);

export async function examples(db: D1Database, anumbers: readonly string[]): Promise<LeaderRow[]> {
  if (anumbers.length === 0) return [];
  const marks = anumbers.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT ${LEADER_COLUMNS} FROM sequences WHERE anumber IN (${marks})`)
    .bind(...anumbers)
    .all<LeaderDbRow>();
  const byNumber = new Map(results.map((r) => [r.anumber, toLeader(r)]));
  return anumbers.flatMap((a) => byNumber.get(a) ?? []);
}

export async function randomAnumber(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare(
      'SELECT anumber FROM sequences WHERE rowid >= (abs(random()) % (SELECT max(rowid) FROM sequences)) + 1 ORDER BY rowid LIMIT 1',
    )
    .first<{ anumber: string }>();
  return row?.anumber ?? null;
}

export interface PiApproximation {
  anumber: string;
  name: string;
  expr: string;
  value: number;
  digits: number;
}

/** Sequences whose leading terms, read as one number, approximate pi under a simple expression. */
export async function piApproximations(db: D1Database, limit = 25): Promise<PiApproximation[]> {
  const { results } = await db
    .prepare(
      'SELECT anumber, name, pi_expr AS expr, pi_value AS value, pi_digits AS digits FROM sequences WHERE pi_digits IS NOT NULL ORDER BY pi_digits DESC, rows ASC, anumber ASC LIMIT ?',
    )
    .bind(limit)
    .all<PiApproximation>();
  return results;
}
