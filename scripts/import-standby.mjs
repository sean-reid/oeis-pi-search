// Loads a sequences SQL file into whichever D1 database is not serving traffic, in chunks D1 accepts,
// then points the live-db KV key at it. Reads block on the database being imported, never the live one.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = process.argv[2];
if (!file) throw new Error('usage: import-standby.mjs <sequences.sql>');

const DATABASES = { a: 'oeis-pi-search', b: 'oeis-pi-search-b' };
const KV_ID = '383d10f676c14d119af298763440044c';
const STATEMENTS_PER_CHUNK = 1000;
const ATTEMPTS = 3;

const wrangler = (args, opts = {}) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...opts,
  });

function liveSlot() {
  try {
    const out = wrangler([
      'kv',
      'key',
      'get',
      'live-db',
      '--namespace-id',
      KV_ID,
      '--remote',
    ]).trim();
    return out === 'b' ? 'b' : 'a';
  } catch {
    return 'a';
  }
}

/** Splits on statement boundaries: every statement in the file ends with a line ending in ';'. */
function chunk(sql) {
  const lines = sql.split('\n');
  const chunks = [];
  let current = [];
  let statements = 0;
  for (const line of lines) {
    current.push(line);
    if (line.endsWith(';')) {
      statements++;
      if (statements % STATEMENTS_PER_CHUNK === 0) {
        chunks.push(current.join('\n'));
        current = [];
      }
    }
  }
  if (current.some((l) => l.trim() !== '')) chunks.push(current.join('\n'));
  return chunks;
}

// Each import is one transaction, so a chunk that fails part way leaves nothing behind and can be rerun.
function importWithRetry(target, path) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return wrangler(['d1', 'execute', target, '--remote', '--yes', '--file', path]);
    } catch (err) {
      lastError = err;
      console.log(`attempt ${attempt} failed: ${String(err.message ?? err).split('\n')[0]}`);
    }
  }
  throw lastError;
}

const live = liveSlot();
const standby = live === 'a' ? 'b' : 'a';
const target = DATABASES[standby];
console.log(`live is ${live} (${DATABASES[live]}), importing into ${standby} (${target})`);

const dir = mkdtempSync(join(tmpdir(), 'd1-chunks-'));
const chunks = chunk(readFileSync(file, 'utf8'));
chunks.forEach((c, i) => {
  const path = join(dir, `${String(i).padStart(3, '0')}.sql`);
  writeFileSync(path, c);
  const started = Date.now();
  const out = importWithRetry(target, path);
  const rows = /"rows_written": (\d+)/.exec(out)?.[1] ?? '?';
  console.log(
    `chunk ${i + 1}/${chunks.length}: ${rows} rows in ${Math.round((Date.now() - started) / 1000)}s`,
  );
});

const count = wrangler([
  'd1',
  'execute',
  target,
  '--remote',
  '--yes',
  '--command',
  'SELECT count(*) AS n FROM sequences',
]);
const n = /"n": (\d+)/.exec(count)?.[1];
if (!n || Number(n) < 1000) throw new Error(`standby has ${n ?? 'no'} rows; not switching`);
console.log(`${n} sequences in ${target}`);

wrangler(['kv', 'key', 'put', 'live-db', standby, '--namespace-id', KV_ID, '--remote']);
console.log(`live-db now ${standby}`);
