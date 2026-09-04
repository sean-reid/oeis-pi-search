import { execFileSync } from 'node:child_process';

export default function globalSetup() {
  execFileSync('node', ['scripts/seed-local.mjs'], { stdio: 'inherit' });
}
