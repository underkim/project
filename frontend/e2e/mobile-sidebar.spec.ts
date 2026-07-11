import { test, expect } from '@playwright/test';

test.describe('모바일 사이드바 내비게이션 상태', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('사이드바 링크 클릭 시 자동으로 닫힌다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.getByRole('link', { name: '재테크', exact: true })).toBeVisible();

    await page.getByRole('link', { name: '재테크', exact: true }).click();
    await expect(page).toHaveURL(/\/finance/);
    // 사이드바가 닫혀 오버레이 배경이 더 이상 존재하지 않아야 한다
    await expect(page.locator('.bg-black\\/30')).toHaveCount(0);
  });

  test('브라우저 뒤로가기로 경로가 바뀌어도 사이드바가 닫힌다', async ({ page }) => {
    // 클라이언트 사이드 네비게이션(Link 클릭)으로 히스토리를 쌓아야 DashboardLayout이
    // 리마운트되지 않은 채로 popstate만 발생 — page.goto()로 이동하면 매번 풀 리로드가
    // 일어나 sidebarOpen state가 항상 초기화되므로 이 회귀를 검증하지 못한다.
    await page.goto('/');
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await page.getByRole('link', { name: '재테크', exact: true }).click();
    await expect(page).toHaveURL(/\/finance/);

    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await page.getByRole('link', { name: '건강', exact: true }).click();
    await expect(page).toHaveURL(/\/health/);

    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.locator('.bg-black\\/30')).toHaveCount(1);

    await page.goBack();
    await expect(page).toHaveURL(/\/finance/);
    await expect(page.locator('.bg-black\\/30')).toHaveCount(0);
  });
});
