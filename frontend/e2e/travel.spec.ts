import { test, expect } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function getAuthHeaders(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${API}/api/v1/auth/token`, {
    form: {
      username: process.env.E2E_USERNAME ?? 'admin',
      password: process.env.E2E_PASSWORD ?? 'admin',
    },
  });
  const { access_token } = (await res.json()) as { access_token: string };
  return { Authorization: `Bearer ${access_token}` };
}

async function cleanupTestTrips(request: import('@playwright/test').APIRequestContext) {
  const headers = await getAuthHeaders(request);
  const res = await request.get(`${API}/api/v1/travel/trips`, { headers });
  if (!res.ok()) return;
  const trips = (await res.json()) as Array<{ id: number; name: string }>;
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

    // 편집 버튼 클릭 (지도·삭제 버튼과 섞여 있어 aria-label로 정확히 지정)
    const headerRow = tripHeading.locator(
      'xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"justify-between")][1]',
    );
    await headerRow.getByRole('button', { name: '여행 편집' }).click();

    // start_date input 수정
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    await dateInputs.nth(0).fill('2030-03-01');
    await dateInputs.nth(1).fill('2030-03-10');

    // 저장 (Check 아이콘 버튼)
    await page.locator('div.flex.gap-2.justify-end').first().getByRole('button').last().click();

    await expect
      .poll(
        async () => {
          const listRes = await request.get(`${API}/api/v1/travel/trips`, { headers });
          if (!listRes.ok()) return '';
          const trips = (await listRes.json()) as Array<{
            name: string;
            start_date: string;
            end_date: string;
          }>;
          const updated = trips.find((t) => t.name === '[E2E] 날짜편집 테스트');
          return updated ? `${updated.start_date}|${updated.end_date}` : '';
        },
        { timeout: 5000 },
      )
      .toBe('2030-03-01|2030-03-10');
  });

  test('여행 삭제 — 확인 단계 없이는 삭제되지 않는다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const createRes = await request.post(`${API}/api/v1/travel/trips`, {
      headers,
      data: {
        name: '[E2E] 삭제확인 테스트',
        destination: '테스트',
        start_date: '2030-01-01',
        end_date: '2030-01-05',
        status: 'planned',
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto('/travel');
    const tripHeading = page.getByRole('heading', { name: '[E2E] 삭제확인 테스트', exact: true });
    await expect(tripHeading).toBeVisible();
    const headerRow = tripHeading.locator(
      'xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"justify-between")][1]',
    );

    await headerRow.getByRole('button', { name: '여행 삭제' }).click();
    const confirmButton = headerRow.getByRole('button', { name: '삭제 확인' });
    await expect(confirmButton).toBeVisible();

    // 취소 클릭 → 여행이 그대로 남아있어야 한다
    await headerRow.getByRole('button', { name: '취소' }).click();
    await expect(tripHeading).toBeVisible();
    const stillThere = await request.get(`${API}/api/v1/travel/trips`, { headers });
    const tripsAfterCancel = (await stillThere.json()) as Array<{ name: string }>;
    expect(tripsAfterCancel.some((t) => t.name === '[E2E] 삭제확인 테스트')).toBe(true);

    // 다시 삭제 → 확인 클릭 → 실제로 삭제된다
    await headerRow.getByRole('button', { name: '여행 삭제' }).click();
    await headerRow.getByRole('button', { name: '삭제 확인' }).click();
    await expect(tripHeading).not.toBeVisible();
  });

  test('체크리스트를 모두 완료하면 진행률 배지가 완료 상태로 바뀐다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const tripRes = await request.post(`${API}/api/v1/travel/trips`, {
      headers,
      data: {
        name: '[E2E] 체크리스트 진행률 테스트',
        destination: '테스트',
        start_date: '2030-01-01',
        end_date: '2030-01-05',
        status: 'planned',
      },
    });
    expect(tripRes.ok()).toBeTruthy();
    const trip = (await tripRes.json()) as { id: number };
    const item1 = await (
      await request.post(`${API}/api/v1/travel/trips/${trip.id}/checklist`, {
        headers,
        data: { text: '여권' },
      })
    ).json();
    const item2 = await (
      await request.post(`${API}/api/v1/travel/trips/${trip.id}/checklist`, {
        headers,
        data: { text: '충전기' },
      })
    ).json();

    await page.goto('/travel');
    const tripHeading = page.getByRole('heading', {
      name: '[E2E] 체크리스트 진행률 테스트',
      exact: true,
    });
    await expect(tripHeading).toBeVisible();
    await expect(page.getByText('0/2 · 0%')).toBeVisible();

    await request.patch(`${API}/api/v1/travel/checklist/${item1.id}/toggle`, { headers });
    await page.reload();
    await expect(page.getByText('1/2 · 50%')).toBeVisible();

    await request.patch(`${API}/api/v1/travel/checklist/${item2.id}/toggle`, { headers });
    await page.reload();
    const doneProgress = page.getByText('2/2 · 100%');
    await expect(doneProgress).toBeVisible();
    await expect(doneProgress).toHaveClass(/text-emerald-600/);
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
        longitude: 126.978,
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto('/travel');
    await expect(
      page.getByRole('heading', { name: '[E2E] 지도렌더 테스트', exact: true }),
    ).toBeVisible();

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
    const trip = (await tripRes.json()) as { id: number };
    await request.post(`${API}/api/v1/travel/trips/${trip.id}/restaurants`, {
      headers,
      data: { name: '[E2E] 돼지국밥집', cuisine: '한식' },
    });

    await page.goto('/travel');
    const tripHeading = page.getByRole('heading', { name: '[E2E] 맛집 테스트', exact: true });
    await expect(tripHeading).toBeVisible();
    // 카드를 펼친 뒤(헤더 우측 Chevron 토글) 맛집 탭으로 이동해 맛집 이름 노출 확인
    const headerRow = tripHeading.locator(
      'xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"justify-between")][1]',
    );
    const tripCard = tripHeading.locator(
      'xpath=ancestor::div[contains(@class,"border") and contains(@class,"rounded-xl")][1]',
    );
    await headerRow.getByRole('button').last().click();
    await tripCard.getByRole('button', { name: /^맛집\s+\d+$/ }).click();
    await expect(page.getByText('[E2E] 돼지국밥집').first()).toBeVisible({ timeout: 10000 });
  });

  test('중복된 이름의 맛집 추가 시 경고 후 확인해야 추가된다', async ({ page, request }) => {
    const headers = await getAuthHeaders(request);
    const tripRes = await request.post(`${API}/api/v1/travel/trips`, {
      headers,
      data: {
        name: '[E2E] 맛집 중복 테스트',
        destination: '부산',
        start_date: '2030-04-01',
        end_date: '2030-04-03',
        status: 'planned',
      },
    });
    expect(tripRes.ok()).toBeTruthy();
    const trip = (await tripRes.json()) as { id: number };
    await request.post(`${API}/api/v1/travel/trips/${trip.id}/restaurants`, {
      headers,
      data: { name: '[E2E] 중복맛집', cuisine: '한식' },
    });

    await page.goto('/travel');
    const tripHeading = page.getByRole('heading', { name: '[E2E] 맛집 중복 테스트', exact: true });
    await expect(tripHeading).toBeVisible();
    const headerRow = tripHeading.locator(
      'xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"justify-between")][1]',
    );
    const tripCard = tripHeading.locator(
      'xpath=ancestor::div[contains(@class,"border") and contains(@class,"rounded-xl")][1]',
    );
    await headerRow.getByRole('button').last().click();
    await tripCard.getByRole('button', { name: /^맛집\s+\d+$/ }).click();

    await tripCard.getByPlaceholder('맛집 이름 *').fill('[E2E] 중복맛집');
    await tripCard.getByRole('button', { name: '맛집 추가' }).click();
    await expect(tripCard.getByText('이미 추가된 맛집과 이름이 같습니다')).toBeVisible();

    // 아직 추가되지 않아야 한다 (경고만 뜬 상태)
    const listAfterWarning = await request.get(`${API}/api/v1/travel/trips`, { headers });
    const tripsAfterWarning = (await listAfterWarning.json()) as Array<{
      id: number;
      restaurants: Array<{ name: string }>;
    }>;
    const tripAfterWarning = tripsAfterWarning.find((t) => t.id === trip.id);
    expect(tripAfterWarning?.restaurants.length).toBe(1);

    // "그래도 추가" 클릭 → 실제로 추가된다
    await tripCard.getByRole('button', { name: '그래도 추가' }).click();
    await expect
      .poll(async () => {
        const listRes = await request.get(`${API}/api/v1/travel/trips`, { headers });
        const trips = (await listRes.json()) as Array<{
          id: number;
          restaurants: Array<{ name: string }>;
        }>;
        return trips.find((t) => t.id === trip.id)?.restaurants.length ?? 0;
      })
      .toBe(2);
  });

  test('시작일이 종료일보다 늦어지면 종료일이 시작일로 자동 조정된다', async ({
    page,
    request,
  }) => {
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

    const headerRow = tripHeading.locator(
      'xpath=ancestor::div[contains(@class,"items-start") and contains(@class,"justify-between")][1]',
    );
    await headerRow.getByRole('button', { name: '여행 편집' }).click();

    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    // 시작일을 종료일보다 늦은 날짜로 변경
    await dateInputs.nth(0).fill('2030-06-01');

    // 종료일이 시작일과 같거나 이후여야 함 (클램프)
    const endVal = await dateInputs.nth(1).inputValue();
    expect(endVal >= '2030-06-01').toBeTruthy();
  });
});
