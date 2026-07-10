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

test.describe('커리어 페이지', () => {
  test('CF 레이팅 기록이 1개뿐이면 추이 차트 대신 안내 문구가 표시된다', async ({
    page,
    request,
  }) => {
    const headers = await getAuthHeaders(request);
    const createRes = await request.post(`${API}/api/v1/career/cf-ratings`, {
      headers,
      data: { log_date: '2026-01-01', rating: 1400, rank_name: 'Specialist' },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as { id: number };

    try {
      await page.goto('/career');
      await expect(page.getByRole('heading', { name: '커리어' })).toBeVisible();
      await expect(page.getByText('레이팅 추이')).toBeVisible();
      await expect(page.getByText(/레이팅 기록이 2개 이상 쌓이면/)).toBeVisible();
      // 차트 자체(LineChart의 SVG)는 렌더되지 않아야 한다
      await expect(page.locator('.recharts-wrapper')).toHaveCount(0);
    } finally {
      await request.delete(`${API}/api/v1/career/cf-ratings/${created.id}`, { headers });
    }
  });
});
