import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('로그인 후 인증 상태 저장', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/login');
  await page.fill('input[placeholder="admin"]', process.env.E2E_USERNAME ?? 'admin');
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD ?? 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');

  await page.context().storageState({ path: authFile });
});
