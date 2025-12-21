import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('BP001 dashboard shows KPI and funnel cards', async ({ page }) => {
  await login(page, 'BP001');
  await expect(page).toHaveURL(/business-partner\/dashboard/);
  await expect(page.getByRole('heading', { name: /Business Partner Dashboard/i })).toBeVisible();
  await expect(page.getByText('Lead Funnel')).toBeVisible();
  await expect(page.getByText('Converted', { exact: false })).toBeVisible();
});

test('FR001 dashboard shows scoped KPIs', async ({ page }) => {
  await login(page, 'FR001');
  await expect(page).toHaveURL(/franchise\/dashboard/);
  await expect(page.getByRole('heading', { name: /Franchise Dashboard/i })).toBeVisible();
  await expect(page.getByText('Lead Funnel')).toBeVisible();
  await expect(page.getByText('Centers Overview')).toBeVisible();
});
