import { test, expect } from '@playwright/test';
import { login, assertCardVisible } from './helpers';

test('SA001 can see dashboard KPIs', async ({ page }) => {
  await login(page, 'SA001');
  await expect(page).toHaveURL(/superadmin\/dashboard/);
  await expect(page.getByRole('heading', { name: /Superadmin Dashboard/i })).toBeVisible();
  await assertCardVisible(page, 'Courses');
  await assertCardVisible(page, 'Modules');
  await assertCardVisible(page, 'Levels');
  await assertCardVisible(page, 'Assessments');
});
