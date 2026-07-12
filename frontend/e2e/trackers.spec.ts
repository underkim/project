import { test, expect } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const TEST_NAME = 'E2E 집중 시간';

async function authHeaders(request: import('@playwright/test').APIRequestContext) {
  const response = await request.post(`${API}/api/v1/auth/token`, {
    form: { username: process.env.E2E_USERNAME ?? 'admin', password: process.env.E2E_PASSWORD ?? 'admin' },
  });
  const { access_token } = await response.json() as { access_token: string };
  return { Authorization: `Bearer ${access_token}` };
}

async function cleanup(request: import('@playwright/test').APIRequestContext) {
  const headers = await authHeaders(request);
  const response = await request.get(`${API}/api/v1/trackers`, { headers, params: { include_archived: true } });
  if (!response.ok()) return;
  const trackers = await response.json() as Array<{ id: number; name: string }>;
  for (const tracker of trackers.filter((item) => item.name.startsWith(TEST_NAME))) {
    await request.delete(`${API}/api/v1/trackers/${tracker.id}`, { headers });
  }
}

test.describe('configurable trackers', () => {
  test.beforeEach(async ({ request }) => cleanup(request));
  test.afterEach(async ({ request }) => cleanup(request));

  test('create, record, edit, archive, restore, and delete', async ({ page }) => {
    await page.goto('/trackers');
    await page.getByRole('button', { name: '추적 항목 만들기' }).click();
    await page.getByLabel('이름').fill(TEST_NAME);
    await page.getByLabel('기록 방식').selectOption('number');
    await page.getByLabel('단위 (선택)').fill('분');
    await page.getByRole('button', { name: '시작하기' }).click();

    await expect(page.getByRole('heading', { name: TEST_NAME })).toBeVisible();
    await page.getByLabel('값 (분)').fill('25');
    await page.getByRole('button', { name: '기록 저장' }).click();
    await expect(page.getByText('25 분')).toBeVisible();

    await page.getByLabel('기록 수정').click();
    await page.getByLabel('값 (분)').fill('30');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByText('30 분')).toBeVisible();

    await page.getByTitle('보관').click();
    await page.getByRole('button', { name: '보관', exact: true }).click();
    await page.getByRole('button', { name: /보관함/ }).click();
    await page.getByRole('button', { name: new RegExp(TEST_NAME) }).click();
    await page.getByRole('button', { name: '복원' }).click();

    await page.getByRole('button', { name: new RegExp(TEST_NAME) }).click();
    await page.getByTitle('완전히 삭제').click();
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(TEST_NAME) })).toHaveCount(0);
  });
});
