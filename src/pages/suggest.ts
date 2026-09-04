import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { searchNames } from '../lib/db';
import { openIndex } from '../lib/index/r2-source';
import { SEARCH_CACHE } from '../lib/respond';
import { describeInput, type Suggestion } from '../lib/suggest';

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q === '') return Response.json([], { headers: { 'Cache-Control': SEARCH_CACHE } });
  const index = await openIndex(env.PI);
  const action = describeInput(q, index.manifest.maxQuery);
  const names = action ? [] : await searchNames(env.DB, q, 8);
  const items: Suggestion[] = action
    ? [action]
    : names.map((m) => ({ label: m.anumber, detail: m.name, href: `/${m.anumber}` }));
  return Response.json(items, { headers: { 'Cache-Control': SEARCH_CACHE } });
};
