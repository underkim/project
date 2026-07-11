import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_USERNAME ?? 'admin';
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('로그인 페이지', () => {
  test('로그인 페이지가 표시된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Life Dashboard')).toBeVisible();
    await expect(page.getByPlaceholder('admin')).toBeVisible();
  });

  test('잘못된 자격증명 → 오류 메시지', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="admin"]', 'wrong');
    await page.fill('input[type="password"]', 'wrong');
    // 응답 완료 후 오류 표시 확인
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/token')),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByText('아이디 또는 비밀번호가 올바르지 않습니다.')).toBeVisible();
  });

  test('429 응답 시 rate-limit 안내 문구가 표시된다', async ({ page }) => {
    await page.route('**/api/v1/auth/token', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Too Many Requests' }),
      }),
    );
    await page.goto('/login');
    await page.fill('input[placeholder="admin"]', E2E_USER);
    await page.fill('input[type="password"]', E2E_PASS);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/token')),
      page.click('button[type="submit"]'),
    ]);
    await expect(
      page.getByText('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.'),
    ).toBeVisible();
  });

  test('인증 없이 / 접근 시 /login 으로 리다이렉트', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('딥링크 접근 시 next 파라미터 포함 /login 으로 리다이렉트', async ({ page }) => {
    await page.goto('/travel');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('next=');
    // 디코딩된 next 값이 /travel인지 확인
    const url = new URL(page.url());
    expect(decodeURIComponent(url.searchParams.get('next') ?? '')).toBe('/travel');
  });

  test('로그인 후 next 경로로 복귀', async ({ page }) => {
    await page.goto('/login?next=%2Ffinance');
    await page.fill('input[placeholder="admin"]', E2E_USER);
    await page.fill('input[type="password"]', E2E_PASS);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/token')),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForURL(/\/finance/);
    expect(page.url()).toContain('/finance');
  });

  test('외부 URL next 값은 / 로 폴백', async ({ page }) => {
    await page.goto('/login?next=https%3A%2F%2Fexample.com');
    await page.fill('input[placeholder="admin"]', E2E_USER);
    await page.fill('input[type="password"]', E2E_PASS);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/token')),
      page.click('button[type="submit"]'),
    ]);
    // / 또는 dashboard 홈으로 이동해야 함 (example.com이 아님)
    await page.waitForURL((url) => !url.toString().includes('example.com'), { timeout: 5000 });
    expect(page.url()).not.toContain('example.com');
  });

  test('프로토콜 상대 URL next 값은 / 로 폴백', async ({ page }) => {
    await page.goto('/login?next=%2F%2Fexample.com');
    await page.fill('input[placeholder="admin"]', E2E_USER);
    await page.fill('input[type="password"]', E2E_PASS);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/token')),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForURL((url) => !url.toString().includes('example.com'), { timeout: 5000 });
    expect(page.url()).not.toContain('example.com');
  });
});
