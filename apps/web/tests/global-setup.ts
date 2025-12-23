import { FullConfig } from '@playwright/test';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export default async function globalSetup(_config: FullConfig) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..', '..', '..');
  const result = spawnSync('pnpm', ['demo:reset', '--', '--seed-only'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`demo:reset failed with exit code ${result.status}`);
  }
}
