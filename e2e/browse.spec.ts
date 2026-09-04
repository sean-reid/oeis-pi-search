import { expect, test } from '@playwright/test';

test('home lists the examples with inline answers', async ({ page }) => {
  await page.goto('/');
  const items = page.locator('.examples li');
  await expect(items).toHaveCount(10);
  await expect(items.first()).toContainText('Fibonacci numbers');
  await expect(items.first()).toContainText('5 terms at 7,143');
});

test('typeahead lists sequence names and opens one from the keyboard', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /sequence/i });
  await box.fill('kolak');
  const options = page.getByRole('option');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText('A000002');
  await box.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/A000002$/);
});

test('typeahead describes what a digit string will do', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /sequence/i });
  await box.fill('31415');
  const option = page.getByRole('option').first();
  await expect(option).toContainText('Find these digits in pi');
  await option.getByRole('link').click({ force: true });
  await expect(page).toHaveURL(/\/digits\/31415$/);
});

test('browse shows the examples and three leaderboards', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.getByRole('heading', { name: 'Deepest' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Earliest' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rarest' })).toBeVisible();
  const tables = page.locator('table.leaders');
  await expect(tables).toHaveCount(3);
  await expect(tables.nth(0).locator('tbody tr').first()).toContainText('A000796');
  await expect(page.getByText('OEIS snapshot 2026-09-04')).toBeVisible();
});

test('random redirects to a sequence page', async ({ page }) => {
  await page.goto('/random');
  await expect(page).toHaveURL(/\/A\d{6}$/);
  await expect(page.locator('table.staircase')).toBeVisible();
});
