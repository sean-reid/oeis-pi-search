// @ts-check
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://oeis-pi-search.dwainosaur.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  session: false,
  vite: {
    define: {
      // Edge cache entries are keyed by build so a deploy never serves HTML that points at retired asset hashes.
      __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
    },
  },
});
