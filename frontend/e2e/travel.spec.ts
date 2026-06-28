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

function getTripCard(page: import('@playwright/test').Page, tripName: string) {
  return page
    .locator('div.border.border-slate-100.rounded-xl')
    .filter({ has: page.getByRole('heading', { name: tripName, exact: true }) })
    .first();
}

async function expandTripCardIfNeeded(tripCard: import('@playwright/test').Locator) {
  if (await tripCard.getByRole('button', { name: '맛집' }).count()) return;
  await tripCard.locator('button:has(svg.lucide-chevron-down), button:has(svg.lucide-chevron-up)').first().click();
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
    const tripCard = getTripCard(page, '[E2E] 날짜편집 테스트');

    await tripCard.getByRole('button', { name: '여행 편집' }).click();

    // start_date input 수정
    const startDateInput = tripCard.getByDisplayValue('2030-01-01');
    const endDateInput = tripCard.getByDisplayValue('2030-01-05');
    await startDateInput.fill('2030-03-01');
    await endDateInput.fill('2030-03-10');

    // 저장 (Check 아이콘 버튼)
    await tripCard.getByRole('button', { name: '여행 저장' }).click();

    await expect.poll(async () => {
      const listRes = await request.get(`${API}/api/v1/travel/trips`, { headers });
      if (!listRes.ok()) return '';
      const trips = await listRes.json() as Array<{ name: string; start_date: string; end_date: string }>;
      const updated = trips.find(t => t.name === '[E2E] 날짜편집 테스트');
      return updated ? `${updated.start_date}|${updated.end_date}` : '';
    }, { timeout: 5000 }).toBe('2030-03-01|2030-03-10');
  });

  test('좌표가 있는 여행이 있으면 지도가 렌더된다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const createRes = await request.post(`${API}/api/v1/travel/trips`, {
      headers,
      data: {
        name: '[E2E] 지도렌더 테스트',
        destination: '서울',
        start_date: '2030-02-01',
        end_date: '2030-02-03',
        status: 'planned',
        latitude: 37.5665,
        longitude: 126.9780,
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto('/travel');
    await expect(page.getByRole('heading', { name: '[E2E] 지도렌더 테스트', exact: true })).toBeVisible();

    // Leaflet 맵 컨테이너가 마운트되어야 한다 (타일 로딩 변동에 영향받지 않도록 컨테이너만 확인)
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 10000 });
  });

  test('맛집을 추가하면 카드에 표시된다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const tripRes = await request.post(`${API}/api/v1/travel/trips`, {
      headers,
      data: {
        name: '[E2E] 맛집 테스트',
        destination: '부산',
        start_date: '2030-04-01',
        end_date: '2030-04-03',
        status: 'planned',
      },
    });
    expect(tripRes.ok()).toBeTruthy();
    const trip = await tripRes.json() as { id: number };
    await request.post(`${API}/api/v1/travel/trips/${trip.id}/restaurants`, {
      headers,
      data: { name: '[E2E] 돼지국밥집', cuisine: '한식' },
    });

    await page.goto('/travel');
    const tripHeading = page.getByRole('heading', { name: '[E2E] 맛집 테스트', exact: true });
    await expect(tripHeading).toBeVisible();
    const tripCard = getTripCard(page, '[E2E] 맛집 테스트');
    await expandTripCardIfNeeded(tripCard);
    await tripCard.getByRole('button', { name: '맛집' }).click();
    await expect(tripCard.getByText('[E2E] 돼지국밥집').first()).toBeVisible({ timeout: 10000 });
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
    const tripCard = getTripCard(page, '[E2E] 날짜클램프 테스트');
    await tripCard.getByRole('button', { name: '여행 편집' }).click();

    const startDateInput = tripCard.getByDisplayValue('2030-01-01');
    const endDateInput = tripCard.getByDisplayValue('2030-01-05');
    // 시작일을 종료일보다 늦은 날짜로 변경
    await startDateInput.fill('2030-06-01');

    // 종료일이 시작일과 같거나 이후여야 함 (클램프)
    const endVal = await endDateInput.inputValue();
    expect(endVal >= '2030-06-01').toBeTruthy();
  });
});
