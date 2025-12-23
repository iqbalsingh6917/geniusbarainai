import { test, expect } from '@playwright/test';

const baseUrl =
  process.env.PLAYWRIGHT_BASE_URL || process.env.WEB_BASE_URL || 'http://localhost:5173';

async function login(page: any, username: string, password?: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel(/username/i).fill(username);
  await page
    .getByLabel(/password/i)
    .fill(password || process.env.DEFAULT_PASSWORD || 'Test@12345');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function getFiltersCard(page: any) {
  const heading = page.getByRole('heading', { name: /settlement filters/i });
  await expect(heading).toBeVisible();
  return heading.locator('..').locator('..');
}

test.describe('Settlements smoke (Center → Franchise → BP)', () => {
  test('center settlements list/detail loads', async ({ page }) => {
    await login(page, process.env.CENTER_USER || 'CE001', process.env.CENTER_PASS);
    await page.goto(`${baseUrl}/center/finance/settlements`);
    await expect(page.getByRole('heading', { name: /settlement filters/i })).toBeVisible();

    const filtersCard = await getFiltersCard(page);
    await expect(filtersCard.locator('input[disabled]').first()).toBeVisible();

    const viewButton = page.locator('table tbody').locator('button', { hasText: 'View' }).first();
    if (await viewButton.count()) {
      await viewButton.click();
      await expect(page.getByRole('heading', { name: /settlement/i })).toBeVisible();
    }
  });

  test('franchise settlements list loads and org unit selector works', async ({ page }) => {
    await login(page, process.env.FR_USER || 'FR001', process.env.FR_PASS);
    await page.goto(`${baseUrl}/franchise/finance/settlements`);
    await expect(page.getByRole('heading', { name: /settlement filters/i })).toBeVisible();

    const filtersCard = await getFiltersCard(page);
    const orgSelect = filtersCard.locator('select').first();
    await expect(orgSelect).toBeVisible();
  });

  test('bp settlements list loads and org unit selector works', async ({ page }) => {
    await login(page, process.env.BP_USER || 'BP001', process.env.BP_PASS);
    await page.goto(`${baseUrl}/business-partner/finance/settlements`);
    await expect(page.getByRole('heading', { name: /settlement filters/i })).toBeVisible();

    const filtersCard = await getFiltersCard(page);
    const orgSelect = filtersCard.locator('select').first();
    await expect(orgSelect).toBeVisible();
  });
});
