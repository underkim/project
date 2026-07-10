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

  test('새로고침 버튼으로 개요를 다시 불러올 수 있다', async ({ page }) => {
    await page.goto('/');
    // 헤더의 새로고침 버튼(aria-label) 클릭 후 개요가 계속 표시되어야 한다
    const refresh = page.getByRole('button', { name: '새로고침' });
    await expect(refresh).toBeVisible();
    await refresh.click();
    await expect(page.getByRole('heading', { name: '오늘의 현황' })).toBeVisible();
  });

  test('개요 로딩에 실패해도 모듈 카드는 계속 표시되고 이동할 수 있다', async ({ page }) => {
    await page.route('**/api/v1/dashboard/overview', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"error"}' }),
    );

    await page.goto('/');
    await expect(page.getByText('데이터를 불러오지 못했습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();

    // 개요 실패와 무관하게 모듈 카드 링크는 항상 클릭 가능해야 한다
    const financeLink = page.getByRole('link', { name: /재테크/i }).first();
    await expect(financeLink).toBeVisible();
    await financeLink.click();
    await expect(page).toHaveURL(/\/finance/);
  });

  test('주간 리포트의 HTML 페이로드가 DOM으로 실행되지 않는다', async ({ page }) => {
    // 주간 리포트 응답을 가로채 heading/bullet/bold + HTML 주입 페이로드를 반환
    await page.route('**/api/v1/ai/weekly-report', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: [
            '## 이번 주 요약',
            '- **운동**을 3회 했어요',
            '<img src=x onerror=window.__xss=1>',
          ].join('\n'),
        }),
      }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: '주간 리포트' }).click();

    // 안전한 형식(heading/bullet/bold)은 그대로 표시
    await expect(page.getByText('이번 주 요약')).toBeVisible();
    await expect(page.locator('strong', { hasText: '운동' })).toBeVisible();

    // 주입된 HTML은 텍스트로 노출되고 실제 img 요소로 생성되지 않음
    await expect(page.getByText('<img src=x onerror=window.__xss=1>')).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);

    // onerror 핸들러가 실행되지 않았는지 확인
    const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
    expect(xss).toBeUndefined();
  });
});
