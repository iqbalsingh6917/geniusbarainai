import { Page, expect } from '@playwright/test';

export async function login(page: Page, username: string, password = 'Test@12345') {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
}

export async function assertCardVisible(page: Page, label: string) {
  await expect(page.getByText(label, { exact: false })).toBeVisible();
}
