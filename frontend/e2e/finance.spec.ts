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

async function cleanupTestRecords(request: import('@playwright/test').APIRequestContext) {
  const headers = await getAuthHeaders(request);
  const res = await request.get(`${API}/api/v1/finance/records`, { headers });
  if (!res.ok()) return;
  const records = await res.json() as Array<{ id: number; record_date: string }>;
  for (const r of records) {
    if (r.record_date === TEST_DATE) {
      await request.delete(`${API}/api/v1/finance/records/${r.id}`, { headers });
    }
  }
}

test.describe('재테크 페이지', () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestRecords(request);
  });

  test('재테크 페이지가 로드된다', async ({ page }) => {
    await page.goto('/finance');
    await expect(page.getByRole('heading', { name: '재테크' })).toBeVisible();
    await expect(page.getByText('총 자산 (최신)')).toBeVisible();
  });

  test('기록 추가 → 목록에 표시된다', async ({ page }) => {
    await page.goto('/finance');
    await page.click('button:has-text("기록 추가")');
    await expect(page.getByText('새 기록')).toBeVisible();

    // label과 input이 htmlFor로 연결되지 않으므로 type/nth 기반 셀렉터 사용
    await page.locator('form input[type="date"]').fill(TEST_DATE);
    await page.locator('form input[type="number"]').nth(0).fill('9999');  // 총 자산
    await page.locator('form input[type="number"]').nth(1).fill('500');   // 월 수입
    await page.locator('form input[type="number"]').nth(2).fill('200');   // 월 지출

    await page.click('button[type="submit"]:has-text("저장")');

    await expect(page.getByText('재테크 기록 저장됨')).toBeVisible();
    await expect(page.getByText(TEST_DATE)).toBeVisible();
  });

  test('자산 목표를 비우고 저장하면 목표가 제거된다', async ({ page }) => {
    // 기존 목표를 localStorage에 주입한 상태로 진입
    await page.addInitScript(() => localStorage.setItem('asset_goal', '5000'));
    await page.goto('/finance');
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });

    // 목표 버튼이 기존 값을 표시
    const goalBtn = page.getByRole('button', { name: /목표 5,000만/ });
    await expect(goalBtn).toBeVisible();
    await goalBtn.click();

    // 입력을 비우고 Enter → 목표 제거
    const input = page.locator('input[placeholder="만원"]');
    await input.fill('');
    await input.press('Enter');

    // "목표 설정" 상태로 복귀하고 localStorage 키가 제거됨
    await expect(page.getByRole('button', { name: '목표 설정' })).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('asset_goal'));
    expect(stored).toBeNull();
  });

  test('기록 삭제 → 목록에서 제거된다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const createRes = await request.post(`${API}/api/v1/finance/records`, {
      headers,
      data: { record_date: TEST_DATE, total_assets: 1234, monthly_income: 100, monthly_expense: 50 },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto('/finance');
    // 로딩 스피너가 사라질 때까지 대기
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(TEST_DATE)).toBeVisible();

    const row = page.locator('tr').filter({ hasText: TEST_DATE });
    await row.getByRole('button').click();
    await page.click('button:has-text("확인")');

    await expect(page.getByText('기록 삭제됨')).toBeVisible();
    await expect(page.getByText(TEST_DATE)).not.toBeVisible();
  });
});
