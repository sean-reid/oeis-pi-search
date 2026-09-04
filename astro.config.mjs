// @ts-check
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://oeis-pi-search.dwainosaur.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  session: false,
});
