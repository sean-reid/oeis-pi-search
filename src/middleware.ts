import { defineMiddleware } from 'astro:middleware';

// Result pages set Cache-Control; this stores them in the edge cache so repeat visits skip D1 and R2.
export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  if (request.method !== 'GET' || typeof caches === 'undefined') return next();
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const url = new URL(request.url);
  url.searchParams.set('build', __BUILD_ID__);
  const key = new Request(url.toString(), { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await next();
  const cc = response.headers.get('Cache-Control') ?? '';
  if (response.ok && cc.includes('max-age')) {
    context.locals.cfContext.waitUntil(cache.put(key, response.clone()));
  }
  return response;
});
