// Pulls every index shard from R2 into a directory so the Rust tool can compute staircases
// against it. Used by the monthly refresh workflow.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: download-index.mjs <dir>');
mkdirSync(dir, { recursive: true });

const get = (name) =>
  execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'r2',
      'object',
      'get',
      `oeis-pi-search/index/v1/${name}`,
      '--file',
      join(dir, name),
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );

get('index.json');
const manifest = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const shardsFor = (bytes) => Math.max(1, Math.ceil(bytes / manifest.shardBytes));
const files = [
  ['digits.bin', Math.ceil(manifest.digits / 2)],
  ...Array.from({ length: manifest.tableMax }, (_, i) => [`table${i + 1}.bin`, 10 ** (i + 1) * 8]),
  ['offsets.bin', 10 ** manifest.bucketPrefix * 4],
  ['buckets.bin', (manifest.digits - manifest.bucketPrefix + 1) * 6],
];
for (const [name, bytes] of files) {
  for (let shard = 0; shard < shardsFor(bytes); shard++) {
    const object = `${name}.${String(shard).padStart(3, '0')}`;
    console.log(object);
    get(object);
  }
}
