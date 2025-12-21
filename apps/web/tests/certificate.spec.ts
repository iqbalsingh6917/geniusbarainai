import { test, expect } from '@playwright/test';

test('Valid certificate shows details', async ({ page }) => {
  await page.goto('/certificate/CERT-ST0001');
  await expect(page.getByText(/Certificate Number/i)).toBeVisible();
  await expect(page.getByText(/ST0001/)).toBeVisible();
  await expect(page.getByText(/Valid|Pending/)).toBeVisible();
});

test('Invalid certificate shows not found state', async ({ page }) => {
  await page.goto('/certificate/NOT-A-CERT');
  await expect(page.getByText(/Certificate not found/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Try demo cert/i })).toBeVisible();
});
