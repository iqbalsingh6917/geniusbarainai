const { spawn, spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const wantsStart = args.includes('--start');
const seedOnly = args.includes('--seed-only') || !wantsStart;
const noReset = args.includes('--no-reset');

function runStep(title, command, commandArgs, env = {}) {
  console.log(`\n=== ${title} ===`);
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`Step "${title}" failed with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function printCheatSheet() {
  const rows = [
    ['Role', 'Username', 'Password'],
    ['Superadmin', 'SA001', 'Test@12345'],
    ['Business Partner', 'BP001', 'Test@12345'],
    ['Franchise', 'FR001', 'Test@12345'],
    ['Center Manager', 'CE001', 'Test@12345'],
    ['Admissions', 'AD001', 'Test@12345'],
    ['Teacher', 'TEA001', 'Test@12345'],
    ['Student', 'STU001', 'Test@12345'],
  ];
  const pad = (val, size) => (val + ' '.repeat(size)).slice(0, size);
  const widths = [16, 14, 12];
  console.log('\nDemo accounts (after seed):');
  rows.forEach((row, idx) => {
    const line = row.map((cell, i) => pad(cell, widths[i])).join('   ');
    console.log(idx === 0 ? line : `  ${line}`);
  });
  console.log('\nUI entry point: http://localhost:5173/login\n');
}

if (seedOnly || wantsStart) {
  if (!noReset) {
    runStep('Resetting database', 'pnpm', ['--filter', '@lms/db', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']);
  }
  runStep('Seeding database (DEMO_SEED=true)', 'pnpm', ['--filter', '@lms/db', 'seed'], {
    DEMO_SEED: 'true',
  });
  printCheatSheet();
}

if (seedOnly) {
  process.exit(0);
}

console.log('\nStarting dev servers (Ctrl+C to stop both)...');
const serverProc = spawn('pnpm', ['--filter', '@lms/server', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
const webProc = spawn('pnpm', ['--filter', '@lms/web', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const shutdown = () => {
  serverProc.kill('SIGINT');
  webProc.kill('SIGINT');
  process.exit(0);
};

serverProc.on('exit', (code) => {
  console.log(`@lms/server exited with code ${code}`);
  shutdown();
});

webProc.on('exit', (code) => {
  console.log(`@lms/web exited with code ${code}`);
  shutdown();
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
