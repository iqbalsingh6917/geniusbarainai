## Operations Runbook

### Migrations (prod-safe)
- Apply migrations: `pnpm --filter @lms/db prisma migrate deploy`
- Generate client (if needed): `pnpm --filter @lms/db prisma generate`

### Seeds (demo data)
- General seed: `pnpm --filter @lms/db seed`
- Additional seeds (if available):
  - `pnpm --filter @lms/db run seed:beats20`
  - `pnpm --filter @lms/db run seed:licenses`
- Tests use isolated fixtures inside `apps/server/tests/helpers` rather than global seeds.

### Core backend checks (pre-release)
- `pnpm --filter @lms/server test:all-core`
- `pnpm --filter @lms/server build`

### Frontend build check
- `pnpm --filter @lms/web build`

### Healthcheck
- Endpoint: `GET /api/health` (no auth). Performs a lightweight DB ping and returns `{ status: 'ok' }` on success.
- Recommended for deploy probes.

### Tagging & Release
- Create the RC tag once CI is green and prod envs are set:
  ```bash
  git tag -a v1.0.0-rc1 -m "Beats LMS v1.0.0-rc1"
  git push origin v1.0.0-rc1
  ```
- `v1.0.0` can later point to the same commit after production validation.

### Production smoke test (read-only)
- Set environment:
  ```bash
  export PROD_API_BASE_URL="https://your-prod-api"
  export SUPERADMIN_TOKEN="..."
  export TEACHER_TOKEN="..."
  export BP_TOKEN="..."
  ```
- Run:
  ```bash
  pnpm smoke:prod
  ```
- Notes:
  - Uses only GET requests; read-only.
  - Requires valid JWTs for real data.
  - Intended to run manually after deploy (or wire to external monitoring later).
