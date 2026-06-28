import { test, expect } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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

async function cleanupTestTrips(request: import('@playwright/test').APIRequestContext) {
  const headers = await getAuthHeaders(request);
  const res = await request.get(`${API}/api/v1/travel/trips`, { headers });
  if (!res.ok()) return;
  const trips = await res.json() as Array<{ id: number; name: string }>;
  for (const t of trips) {
    if (t.name.startsWith('[E2E]')) {
      await request.delete(`${API}/api/v1/travel/trips/${t.id}`, { headers });
    }
  }
}

test.describe('여행 페이지', () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestTrips(request);
  });

  test('여행 페이지가 로드된다', async ({ page }) => {
    await page.goto('/travel');
    await expect(page.getByRole('heading', { name: '여행 계획' })).toBeVisible();
  });

  test('여행 날짜 편집 — 시작/종료일 변경 후 저장', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const createRes = await request.post(`${API}/api/v1/travel/trips`, {
      headers,
      data: {
        name: '[E2E] 날짜편집 테스트',
        destination: '테스트',
        start_date: '2030-01-01',
        end_date: '2030-01-05',
        status: 'planned',
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto('/travel');
    const tripHeading = page.getByRole('heading', { name: '[E2E] 날짜편집 테스트', exact: true });
    await expect(tripHeading).toBeVisible();

    // 편집 버튼 클릭 (Pencil 아이콘 버튼 — 해당 카드 내)
    const headerRow = tripHeading.locator('xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"justify-between")][1]');
    await headerRow.getByRole('button').first().click();

    // start_date input 수정
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    await dateInputs.nth(0).fill('2030-03-01');
    await dateInputs.nth(1).fill('2030-03-10');

    // 저장 (Check 아이콘 버튼)
    await page.locator('div.flex.gap-2.justify-end').first().getByRole('button').last().click();

    await expect.poll(async () => {
      const listRes = await request.get(`${API}/api/v1/travel/trips`, { headers });
      if (!listRes.ok()) return '';
      const trips = await listRes.json() as Array<{ name: string; start_date: string; end_date: string }>;
      const updated = trips.find(t => t.name === '[E2E] 날짜편집 테스트');
      return updated ? `${updated.start_date}|${updated.end_date}` : '';
    }, { timeout: 5000 }).toBe('2030-03-01|2030-03-10');
  });

  test('시작일이 종료일보다 늦어지면 종료일이 시작일로 자동 조정된다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const createRes = await request.post(`${API}/api/v1/travel/trips`, {
      headers,
      data: {
        name: '[E2E] 날짜클램프 테스트',
        destination: '테스트',
        start_date: '2030-01-01',
        end_date: '2030-01-05',
        status: 'planned',
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto('/travel');
    const tripHeading = page.getByRole('heading', { name: '[E2E] 날짜클램프 테스트', exact: true });
    await expect(tripHeading).toBeVisible();

    const headerRow = tripHeading.locator('xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"justify-between")][1]');
    await headerRow.getByRole('button').first().click();

    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    // 시작일을 종료일보다 늦은 날짜로 변경
    await dateInputs.nth(0).fill('2030-06-01');

    // 종료일이 시작일과 같거나 이후여야 함 (클램프)
    const endVal = await dateInputs.nth(1).inputValue();
    expect(endVal >= '2030-06-01').toBeTruthy();
  });
});
