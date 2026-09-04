// Browsers revalidate after five minutes; the edge keeps a copy for a day under a per-build key.
export const RESULT_CACHE = 'public, max-age=300, s-maxage=86400';
export const SEARCH_CACHE = 'public, max-age=300, s-maxage=3600';
