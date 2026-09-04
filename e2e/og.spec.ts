import { expect, test } from '@playwright/test';

test('sequence pages advertise an OpenGraph image that renders as a PNG', async ({
  page,
  request,
}) => {
  await page.goto('/A000045');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/\/og\/A000045\.png$/);
  const res = await request.get('/og/A000045.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
  const body = await res.body();
  expect(body.subarray(1, 4).toString()).toBe('PNG');
  expect(body.length).toBeGreaterThan(10_000);
});

test('digit pages get an image too and unknown sequences do not', async ({ request }) => {
  const ok = await request.get('/og/digits/14159.png');
  expect(ok.status()).toBe(200);
  const missing = await request.get('/og/A999999.png');
  expect(missing.status()).toBe(404);
});

test('the self hosted fonts are served', async ({ request }) => {
  for (const f of ['newsreader.woff2', 'jetbrainsmono-regular.woff2', 'og/newsreader-400.ttf']) {
    const res = await request.get(`/fonts/${f}`);
    expect(res.status(), f).toBe(200);
  }
});
