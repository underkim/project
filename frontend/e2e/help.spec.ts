import { test, expect } from '@playwright/test';

test.describe('가이드 페이지 컨텍스트 단축키', () => {
  test('재테크 페이지의 도움말 아이콘이 가이드의 재테크 섹션으로 이동한다', async ({ page }) => {
    await page.goto('/finance');
    await page.getByRole('link', { name: '재테크 도움말' }).click();
    await expect(page).toHaveURL(/\/help#finance/);
    await expect(page.locator('#finance').getByRole('heading', { name: '재테크' })).toBeVisible();
  });

  test('여행 페이지의 도움말 아이콘이 가이드의 여행 섹션으로 이동한다', async ({ page }) => {
    await page.goto('/travel');
    await page.getByRole('link', { name: '여행 도움말' }).click();
    await expect(page).toHaveURL(/\/help#travel/);
    await expect(page.locator('#travel').getByRole('heading', { name: '여행' })).toBeVisible();
  });
});
