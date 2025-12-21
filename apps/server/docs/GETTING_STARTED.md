## Prerequisites
- Node.js + pnpm
- PostgreSQL running and reachable
- Environment variables:
  - `DATABASE_URL`
  - `JWT_SECRET` (tests default to `testsecret123456` if unset)

## Install & DB
```bash
pnpm install
pnpm --filter @lms/db prisma migrate dev
pnpm --filter @lms/db prisma generate
```

## Run
- Backend (dev): `pnpm --filter @lms/server dev`
- Frontend (dev): `pnpm --filter @lms/web dev`

## Tests
- Assessments (exams + worksheets): `pnpm --filter @lms/server test:assessments`
- Licensing & finance: `pnpm --filter @lms/server test:licensing-finance`
- Reports / analytics: `pnpm --filter @lms/server test:reports`
- Full core sweep: `pnpm --filter @lms/server test:all-core`
- CI wrapper (from repo root): `pnpm ci:verify`

## Healthcheck
- Backend liveness: `GET /api/health` (no auth, pings DB).
- In CI/deploy, run `pnpm --filter @lms/server test:all-core` and optionally hit `/api/health`.

## Notes
- Seed data: use existing seed helpers in `apps/server/src/tests/helpers` for assessments; create minimal fixtures in tests as needed.
- Org scoping: dashboards and analytics use `getAllowedOrgUnitsForUser`; roles must align with orgUnitId.
- API responses use `ok/fail` helpers; do not alter response shapes.
