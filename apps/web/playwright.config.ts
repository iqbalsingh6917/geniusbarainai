import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const rootDir = path.resolve(__dirname, '..', '..');

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    headless: true,
  },
  globalSetup: path.join(__dirname, 'tests', 'global-setup.ts'),
  webServer: [
    {
      command: 'pnpm --filter @lms/server dev',
      port: 9000,
      reuseExistingServer: true,
      cwd: rootDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    },
    {
      command: 'pnpm --filter @lms/web dev -- --host --port 5173',
      port: 5173,
      reuseExistingServer: true,
      cwd: path.resolve(__dirname),
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
