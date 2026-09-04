import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      '.astro/',
      '.wrangler/',
      'tools/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'worker-configuration.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
);
