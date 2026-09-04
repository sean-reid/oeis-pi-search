import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { randomAnumber } from '../lib/db';

export const GET: APIRoute = async ({ redirect }) => {
  const anumber = await randomAnumber(env.DB);
  const res = redirect(anumber ? `/${anumber}` : '/', 302);
  res.headers.set('Cache-Control', 'no-store');
  return res;
};
