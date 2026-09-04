import { env } from 'cloudflare:workers';

export type Slot = 'a' | 'b';
export const LIVE_KEY = 'live-db';
const TTL_MS = 60_000;

let cached: { slot: Slot; at: number } | undefined;

/** The KV pointer names which of the two databases serves reads; the other one is free to import. */
export async function liveSlot(kv: KVNamespace, now = Date.now()): Promise<Slot> {
  if (cached && now - cached.at < TTL_MS) return cached.slot;
  const value = await kv.get(LIVE_KEY);
  const slot: Slot = value === 'b' ? 'b' : 'a';
  cached = { slot, at: now };
  return slot;
}

export function dbForSlot(slot: Slot): D1Database {
  return slot === 'b' ? env.DB_B : env.DB_A;
}

export async function liveDb(): Promise<D1Database> {
  return dbForSlot(await liveSlot(env.CACHE));
}

export function resetLiveCache() {
  cached = undefined;
}
