import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { openIndex } from '../../../lib/index/r2-source';
import { ogImage } from '../../../lib/og';
import { staircase } from '../../../lib/staircase';

export const GET: APIRoute = async ({ params, url }) => {
  const digits = params.digits ?? '';
  const index = await openIndex(env.PI);
  if (!/^\d+$/.test(digits) || digits.length > index.manifest.maxQuery) {
    return new Response(null, { status: 404 });
  }
  const rows = await staircase(index, Array.from(digits));
  return ogImage(
    { eyebrow: 'digits', title: digits, rows, totalDigits: index.manifest.digits, noun: 'digits' },
    env.ASSETS,
    url.origin,
  );
};
