import type { APIRoute } from 'astro';
import { liveDb } from '../lib/live-db';
import { randomAnumber } from '../lib/db';

export const GET: APIRoute = async ({ redirect }) => {
  const db = await liveDb();
  const anumber = await randomAnumber(db);
  const res = redirect(anumber ? `/${anumber}` : '/', 302);
  res.headers.set('Cache-Control', 'no-store');
  return res;
};
