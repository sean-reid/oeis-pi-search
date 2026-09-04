// Loads the e2e fixtures into wrangler's local D1 and R2 state so `pnpm serve` answers like production.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const persist = '.wrangler/state';
const fixtures = join('src', 'lib', 'index', 'fixtures');

function wrangler(...args) {
  execFileSync('pnpm', ['exec', 'wrangler', ...args, '--persist-to', persist], {
    stdio: 'inherit',
  });
}

wrangler(
  'd1',
  'execute',
  'oeis-pi-search',
  '--local',
  '--file',
  join('e2e', 'fixtures', 'seed.sql'),
);
for (const file of readdirSync(fixtures)) {
  wrangler(
    'r2',
    'object',
    'put',
    `oeis-pi-search/index/v1/${file}`,
    '--local',
    '--file',
    join(fixtures, file),
  );
}
