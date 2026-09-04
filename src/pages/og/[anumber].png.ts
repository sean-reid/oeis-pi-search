import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { liveDb } from '../../lib/live-db';
import { getMeta, getSequence } from '../../lib/db';
import { ANUMBER } from '../../lib/format';
import { ogImage } from '../../lib/og';

export const GET: APIRoute = async ({ params, url }) => {
  const db = await liveDb();
  const anumber = params.anumber ?? '';
  if (!ANUMBER.test(anumber)) return new Response(null, { status: 404 });
  const [record, meta] = await Promise.all([getSequence(db, anumber), getMeta(db)]);
  if (!record) return new Response(null, { status: 404 });
  return ogImage(
    {
      eyebrow: anumber,
      title: record.name,
      rows: record.staircase,
      totalDigits: Number(meta.digits),
    },
    env.ASSETS,
    url.origin,
  );
};
