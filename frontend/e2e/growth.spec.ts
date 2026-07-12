import { test, expect } from '@playwright/test';

test('legacy growth route moves users to configurable trackers', async ({ page }) => {
  await page.goto('/growth');
  await expect(page).toHaveURL(/\/trackers$/);
  await expect(page.getByRole('heading', { name: '나의 기록' })).toBeVisible();
});
