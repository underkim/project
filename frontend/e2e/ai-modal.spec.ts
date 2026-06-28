import { test, expect } from '@playwright/test';

test.describe('AI 모달', () => {
  test('FAB 클릭 시 AI 채팅 패널이 열리고 입력창이 보인다', async ({ page }) => {
    await page.goto('/');

    // FAB 버튼 (접근 가능한 title 셀렉터)
    const fab = page.getByTitle('AI 어시스턴트');
    await expect(fab).toBeVisible();
    await fab.click();

    // 채팅 입력창이 나타나야 한다 (placeholder로 안정적 식별)
    const input = page.getByPlaceholder(/오늘 러닝 40분 했어/);
    await expect(input).toBeVisible();

    // 주간 리포트 버튼도 패널 헤더에 노출
    await expect(page.getByRole('button', { name: '주간 리포트' })).toBeVisible();
  });

  test('FAB를 다시 클릭하면 패널이 닫힌다', async ({ page }) => {
    await page.goto('/');
    const fab = page.getByTitle('AI 어시스턴트');
    await fab.click();
    const input = page.getByPlaceholder(/오늘 러닝 40분 했어/);
    await expect(input).toBeVisible();

    // 닫기 (FAB 토글)
    await fab.click();
    await expect(input).toBeHidden();
  });

  test('Escape 키로 패널을 닫고 FAB로 포커스가 돌아온다', async ({ page }) => {
    await page.goto('/');
    const fab = page.getByRole('button', { name: 'AI 어시스턴트 열기' });
    await fab.click();
    const input = page.getByPlaceholder(/오늘 러닝 40분 했어/);
    await expect(input).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
    // 포커스가 트리거(FAB)로 복원되어야 한다
    await expect(page.getByRole('button', { name: 'AI 어시스턴트 열기' })).toBeFocused();
  });
});
