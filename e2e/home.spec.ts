import { expect, test } from '@playwright/test';

test('home page renders the question', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/first appear in pi/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('first appear in pi');
  await expect(page.getByRole('link', { name: 'OEIS' })).toBeVisible();
});
