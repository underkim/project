import { test, expect } from '@playwright/test';

test.describe('대시보드 홈', () => {
  test('대시보드 개요 페이지가 로드된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('재테크')).toBeVisible();
    await expect(page.getByText('건강')).toBeVisible();
    await expect(page.getByText('커리어')).toBeVisible();
  });

  test('각 도메인 카드가 표시된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /재테크/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /건강/i }).first()).toBeVisible();
  });

  test('AI FAB 버튼이 표시된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTitle('AI 어시스턴트')).toBeVisible();
  });
});
