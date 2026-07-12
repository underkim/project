import { test, expect } from '@playwright/test';

test('legacy career route moves users to configurable trackers', async ({ page }) => {
  await page.goto('/career');
  await expect(page).toHaveURL(/\/trackers$/);
  await expect(page.getByRole('heading', { name: '나의 기록' })).toBeVisible();
});
