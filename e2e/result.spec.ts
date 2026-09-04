import { expect, test } from '@playwright/test';

test('a sequence page shows the staircase against the seeded index', async ({ page }) => {
  await page.goto('/A000045');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A000045');
  await expect(page.getByText('Fibonacci numbers')).toBeVisible();
  await expect(page.locator('[data-headline]')).toContainText(
    'The first 5 terms appear at position 7,143',
  );
  const rows = page.locator('table.staircase tbody tr');
  await expect(rows).toHaveCount(7);
  await expect(rows.nth(0)).toContainText('1,954');
  await expect(rows.nth(5)).toContainText('not within 20,000');
  await expect(page.locator('[data-strip="5"]')).toBeVisible();
  await expect(page.locator('[data-strip="5"] mark')).toHaveText('01123');
});

test('clicking a row swaps the digit strip and updates the url', async ({ page }) => {
  await page.goto('/A000045');
  await page.locator('tr[data-k="3"] a').click();
  await expect(page.locator('[data-strip="3"]')).toBeVisible();
  await expect(page.locator('[data-strip="5"]')).toBeHidden();
  await expect(page.locator('[data-headline]')).toContainText(
    'The first 3 terms appear at position 361',
  );
  await expect(page).toHaveURL(/\/A000045\/3$/);
});

test('a row can be selected by url without javascript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/A000045/2');
  await expect(page.locator('[data-strip="2"]')).toBeVisible();
  await expect(page.locator('[data-headline]')).toContainText('position 167');
  await context.close();
});

test('raw digits are searched live against the index', async ({ page }) => {
  await page.goto('/digits/14159');
  await expect(page.locator('[data-headline]')).toContainText('All 5 digits appear at position 1');
  await expect(page.locator('table.staircase tbody tr')).toHaveCount(5);
});

test('comma separated terms are concatenated', async ({ page }) => {
  await page.goto('/terms/1,-1,2');
  await expect(page.locator('table.staircase tbody tr').nth(2)).toContainText('112');
});

test('the search box routes each kind of input', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: /sequence/i });
  await box.fill('a45');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/A000045$/);

  await page.goto('/');
  await box.fill('31415');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/digits\/31415$/);

  await page.goto('/');
  await box.fill('Kolakoski');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=Kolakoski$/);
  await expect(page.getByRole('link', { name: /A000002/ })).toBeVisible();
});

test('unknown sequences and bad input get a clear 404', async ({ page }) => {
  const res = await page.goto('/A999999');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('No sequence A999999');
  const long = await page.goto('/digits/1234567890123');
  expect(long?.status()).toBe(404);
  await expect(page.getByText(/longer than 7 digits/)).toBeVisible();
});

test('sequences with negative terms carry a note', async ({ page }) => {
  await page.goto('/A001057');
  await expect(page.getByText('Minus signs are dropped')).toBeVisible();
  await expect(page.locator('table.staircase tbody tr').nth(2)).toContainText('011');
});
