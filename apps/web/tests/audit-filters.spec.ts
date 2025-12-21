import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('Superadmin audit view filters by type', async ({ page }) => {
  await login(page, 'SA001');
  await page.goto('/superadmin/activity');

  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const totalRows = await rows.count();

  await page.selectOption('#activity-type-filter', 'ASSESSMENT');
  const filteredCount = await rows.count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThanOrEqual(totalRows);
  await expect(rows.first().getByText(/Assessment/i)).toBeVisible();
});
