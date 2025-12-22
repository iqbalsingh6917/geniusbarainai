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

### Demo reset
- Reset + seed (CI-safe, exits): `pnpm demo:reset`
- Reset + seed + start dev servers (long-running): `pnpm demo:reset:start`

### Performance hotspots and fixes
- Hotspots (code review): `/api/dashboard/*` (superadmin/bp/franchise/center), `/api/reports/finance/advanced`, `/api/reports/commissions/rollups`, `/api/reports/assessments`, `/api/finance/*` (dues/transactions), `/api/licensing/allocations`.
- Fixes applied: request timing logs with `requestId`, slow query logging (default 200ms), and pagination defaults for report list endpoints (`/api/reports/students`, `/api/reports/enrollments`, `/api/reports/attendance`).
- For investigation: set `SLOW_QUERY_THRESHOLD_MS` to tune logging in dev/staging.
- Cold start note: the first request after boot can log slow queries; measure after warm-up in production mode.

### AI Assist (rule-based, leads only)
- Deterministic scoring and suggestions for leads; no external services or automated actions.
- Output: score (0-100), tier (HOT/WARM/COLD), reasons (max 6), nextAction, suggestedMessage.
- Scoring rules and thresholds live in `apps/server/src/services/leadAssistService.ts` (SCORE_RULES, TIER_THRESHOLDS).
- Keep changes safe: edit constants only, preserve reason strings, and avoid logging PII.

### Lead follow-up discipline
- Follow-up buckets (server filter `followUp=`):
  - `overdue`: `nextFollowUpAt < now` and stage not in `CONVERTED/LOST`
  - `due_today`: `nextFollowUpAt` within today (local server time) and stage not in `CONVERTED/LOST`
  - `due_next_7_days`: `nextFollowUpAt` between now and now + 7 days and stage not in `CONVERTED/LOST`
  - `none`: `nextFollowUpAt` is null
- Snooze behavior (`POST /api/leads/:id/snooze`):
  - Allowed days: 1, 3, 7
  - Uses `max(now, existing nextFollowUpAt) + days`
  - Not allowed for `CONVERTED` or `LOST`

### Ops/Finance anomaly flags (rule-based)
- Purpose: highlight potential operational risks (no automation, no external services).
- Endpoints:
  - `GET /api/ops/anomalies/summary?window=30`
  - `GET /api/ops/anomalies/by-unit?window=30&limit=&offset=` (SUPERADMIN/BP only)
- Rules and thresholds:
  - `COLLECTION_DROP` (WARN >= 30%, CRITICAL >= 50%): collections in last `window` days vs prior `window` days.
  - `DUE_SPIKE` (WARN): outstanding dues increase >= 30% over the last 14 days (based on fee record createdAt).
  - `PAYMENT_OVERDUE_CLUSTER` (WARN): overdue dues count >= 10 or jump >= 50% vs prior window.
  - `ZERO_ACTIVITY` (INFO): no enrollments and no collections in the last 14 days.
- Overdue definition: Student fee records with status `PENDING` or `PARTIAL` and `createdAt` older than 30 days.
- Actions: treat WARN/CRITICAL as follow-up prompts only; investigate collections, data entry, and enrollment flow.

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
