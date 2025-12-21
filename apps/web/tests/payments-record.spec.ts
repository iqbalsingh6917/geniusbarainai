import { test, expect } from '@playwright/test';
import { login } from './helpers';

function extractNumber(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return Number(digits || '0');
}

test('Center manager can record a payment and reduce outstanding', async ({ page }) => {
  await login(page, 'CE001');
  await page.goto('/center/finance');

  const outstandingCard = page.getByRole('heading', { name: /Outstanding Amount/i }).locator('..');
  const outstandingText = await outstandingCard.locator('p').first().textContent();
  const startingOutstanding = extractNumber(outstandingText || '');

  await page.getByRole('button', { name: /Record Payment/i }).click();
  await page.getByLabel('Amount (?)').fill('6000');
  await page.getByLabel('Payment Method').selectOption('UPI');
  await page.getByLabel('Notes').fill('Playwright demo payment');
  await page.locator('form').last().getByRole('button', { name: /^Record Payment$/i }).click();

  await expect(page.getByText(/Payment recorded successfully/i)).toBeVisible();

  const updatedText = await outstandingCard.locator('p').first().textContent();
  const updatedOutstanding = extractNumber(updatedText || '');

  expect(updatedOutstanding).toBeLessThan(startingOutstanding);
});
