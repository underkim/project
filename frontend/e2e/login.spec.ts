import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('로그인 페이지', () => {
  test('로그인 페이지가 표시된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Life Dashboard')).toBeVisible();
    await expect(page.getByPlaceholder('admin')).toBeVisible();
  });

  test('잘못된 자격증명 → 오류 메시지', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="admin"]', 'wrong');
    await page.fill('input[type="password"]', 'wrong');
    // 응답 완료 후 오류 표시 확인
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/auth/token')),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByText('아이디 또는 비밀번호가 올바르지 않습니다.')).toBeVisible();
  });

  test('인증 없이 / 접근 시 /login 으로 리다이렉트', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});
