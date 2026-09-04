import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: { DB_A: 'a-db', DB_B: 'b-db', CACHE: {} } }));

import { dbForSlot, liveSlot, resetLiveCache } from './live-db';

function kv(value: string | null) {
  const get = vi.fn(async () => value);
  return { kv: { get } as unknown as KVNamespace, get };
}

describe('liveSlot', () => {
  beforeEach(() => resetLiveCache());

  it('defaults to a and reads b when the pointer says so', async () => {
    expect(await liveSlot(kv(null).kv)).toBe('a');
    resetLiveCache();
    expect(await liveSlot(kv('b').kv)).toBe('b');
    resetLiveCache();
    expect(await liveSlot(kv('garbage').kv)).toBe('a');
  });

  it('caches the pointer for a minute', async () => {
    const { kv: store, get } = kv('b');
    await liveSlot(store, 1000);
    await liveSlot(store, 30_000);
    expect(get).toHaveBeenCalledTimes(1);
    await liveSlot(store, 70_000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('maps slots to bindings', () => {
    expect(dbForSlot('a')).toBe('a-db');
    expect(dbForSlot('b')).toBe('b-db');
  });
});
