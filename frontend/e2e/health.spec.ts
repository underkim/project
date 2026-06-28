import { test, expect } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const TEST_DATE = '1999-12-31';

async function getAuthHeaders(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${API}/api/v1/auth/token`, {
    form: {
      username: process.env.E2E_USERNAME ?? 'admin',
      password: process.env.E2E_PASSWORD ?? 'admin',
    },
  });
  const { access_token } = await res.json() as { access_token: string };
  return { Authorization: `Bearer ${access_token}` };
}

async function cleanupExercise(request: import('@playwright/test').APIRequestContext) {
  const headers = await getAuthHeaders(request);
  const res = await request.get(`${API}/api/v1/health/exercise`, { headers });
  if (!res.ok()) return;
  const logs = await res.json() as Array<{ id: number; log_date: string }>;
  for (const l of logs) {
    if (l.log_date === TEST_DATE) {
      await request.delete(`${API}/api/v1/health/exercise/${l.id}`, { headers });
    }
  }
}

test.describe('건강 페이지', () => {
  test.afterEach(async ({ request }) => {
    await cleanupExercise(request);
  });

  test('건강 페이지가 로드된다', async ({ page }) => {
    await page.goto('/health');
    await expect(page.getByRole('heading', { name: '건강' })).toBeVisible();
    // exact: true로 중복 텍스트 방지
    await expect(page.getByText('이번 주 운동', { exact: true })).toBeVisible();
    await expect(page.getByText('운동 기록', { exact: true })).toBeVisible();
  });

  test('운동 기록 추가 → 목록에 표시된다', async ({ page }) => {
    await page.goto('/health');
    await page.locator('button:has-text("추가")').first().click();

    // 폼 입력 (date: type, exercise_type: placeholder, duration: number)
    await page.locator('form input[type="date"]').fill(TEST_DATE);
    await page.getByPlaceholder('러닝, 헬스...').fill('E2E 테스트 운동');
    await page.locator('form input[type="number"]').fill('45');

    await page.click('button[type="submit"]:has-text("저장")');

    await expect(page.getByText('운동 기록 저장됨')).toBeVisible();
    const item = page.getByText('E2E 테스트 운동', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await expect(item.getByText('E2E 테스트 운동', { exact: true })).toBeVisible();
    await expect(item.getByText('45분', { exact: true })).toBeVisible();
  });

  test('운동 기록 삭제 → 목록에서 제거된다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const createRes = await request.post(`${API}/api/v1/health/exercise`, {
      headers,
      data: { log_date: TEST_DATE, exercise_type: 'E2E 삭제 테스트', duration_minutes: 30 },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto('/health');
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E 삭제 테스트', { exact: true })).toBeVisible();

    const item = page.getByText('E2E 삭제 테스트', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await item.hover();
    await item.locator('button').click();
    await page.click('button:has-text("확인")');

    await expect(page.getByText('운동 기록 삭제됨')).toBeVisible();
    await expect(page.getByText('E2E 삭제 테스트', { exact: true })).not.toBeVisible();
  });
});
