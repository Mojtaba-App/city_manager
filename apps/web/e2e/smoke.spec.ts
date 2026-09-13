import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('login page renders RTL form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByText('سامانه مدیر شهر؛ زیرساخت هوشمند بازآفرینی شهری')).toBeVisible();
  });

  test('unauthenticated dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated map redirects to login', async ({ page }) => {
    await page.goto('/dashboard/map');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated layers page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/layers');
    await expect(page).toHaveURL(/\/login/);
  });

  test('staff login stores session in cookies, not localStorage', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { expiresIn: '15m', tokenType: 'Bearer', session: 'cookie' },
        }),
      });
    });
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'u1',
            email: 'admin@city.local',
            firstName: 'Admin',
            lastName: 'User',
            roles: ['super_admin'],
            permissions: [],
          },
        }),
      });
    });
    await page.goto('/login');
    await page.locator('#password').fill('Admin@1234');
    await page.getByRole('button', { name: /ورود/ }).click();
    await page.waitForURL(/\/dashboard/);
    expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
  });

  test('citizen portal login renders invite code field', async ({ page }) => {
    await page.goto('/portal');
    await expect(page.locator('#portal-code')).toBeVisible();
    await expect(page.getByRole('button', { name: /ورود به پرونده/ })).toBeVisible();
  });
});
