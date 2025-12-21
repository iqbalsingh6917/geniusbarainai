import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('Center manager can create and convert a lead', async ({ page }) => {
  await login(page, 'CE001');
  await page.goto('/center/leads');

  const leadName = `AutoLead-${Date.now()}`;
  page.once('dialog', (dialog) => dialog.accept(leadName));
  await page.getByRole('button', { name: /New lead/i }).click();

  await expect(page.getByText(leadName)).toBeVisible();

  const row = page.getByRole('row', { name: new RegExp(leadName) });
  const stageSelect = row.locator('select').first();
  await stageSelect.selectOption('CONVERTED');

  await expect(row.getByText('CONVERTED')).toBeVisible();
});
