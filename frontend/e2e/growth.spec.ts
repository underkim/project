import { test, expect } from '@playwright/test';

test.describe('자기계발 페이지 - 뮤테이션 중복 방지', () => {
  test('책 추가 폼 중복 제출 방지', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/v1/growth/books', async route => {
      if (route.request().method() === 'POST') {
        requestCount += 1;
        await new Promise(resolve => setTimeout(resolve, 400));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 9999, title: '테스트책', author: null, status: 'planned',
            rating: null, note: null, start_date: null, end_date: null,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/growth');
    await expect(page.getByText('독서 목록', { exact: true })).toBeVisible();

    // 책 추가 폼 열기
    await page.getByRole('button', { name: '+ 추가' }).first().click();
    await page.locator('input[placeholder="책 제목"]').fill('테스트책');

    const submitBtn = page.locator('button[type="submit"]').first();

    // 첫 번째 클릭 → in-flight 시작
    await submitBtn.click();

    // 버튼 비활성화 확인
    await expect(submitBtn).toBeDisabled();

    // 두 번째 클릭 (무시됨)
    await submitBtn.click({ force: true });

    // 완료 후 폼 닫힘 확인
    await expect(page.locator('button[type="submit"]')).toHaveCount(0, { timeout: 10000 });

    // 요청이 정확히 1회만 전송됨
    expect(requestCount).toBe(1);
  });

  test('영어 학습 기록 추가 폼 중복 제출 방지', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/v1/growth/english', async route => {
      if (route.request().method() === 'POST') {
        requestCount += 1;
        await new Promise(resolve => setTimeout(resolve, 400));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 9998, log_date: '2030-01-01', activity_type: 'reading',
            duration_minutes: 30, note: null,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/growth');
    await expect(page.getByText('영어 학습 기록', { exact: true })).toBeVisible();

    // 영어 추가 폼 열기 (두 번째 + 추가 버튼)
    await page.getByRole('button', { name: '+ 추가' }).nth(1).click();
    await page.locator('input[type="number"]').last().fill('30');

    const submitBtn = page.locator('button[type="submit"]').last();

    await submitBtn.click();
    await expect(submitBtn).toBeDisabled();
    await submitBtn.click({ force: true });

    await expect(page.locator('button[type="submit"]')).toHaveCount(0, { timeout: 10000 });
    expect(requestCount).toBe(1);
  });
});
