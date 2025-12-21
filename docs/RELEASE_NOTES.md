## v1.0.0-rc1 - Release Candidate

This tag represents the current stable RC of Beats LMS. All core domains are implemented, wired to real data, and covered by automated tests/CI:

- **Authentication & Security:** JWT-based auth, role guards, superadminOnly, test-user override for tests.
- **Organization Hierarchy & Users:** Org tree with scoped dashboards; teacher-student assignments; `getAllowedOrgUnitsForUser` reused across routes.
- **Licensing & Finance:** License capacity/expiry enforcement; finance summaries; dedicated licensing/finance tests.
- **Abacus Curriculum:** Courses/modules/levels/worksheets builder and CRUD.
- **Worksheets 2.0:** Models, auto-grading (MCQ/NUMERIC/TEXT), student player, teacher review/override, analytics, tests.
- **Exams 2.0:** Exam models, delivery/grading, teacher review/override, analytics, tests.
- **Dashboards (all roles):** Superadmin, BP, Franchise, Center, Teacher, Student connected to scoped data.
- **Leads & Sales:** Lead + LeadActivity domain, scoped routes, full UI for BP/Franchise/Center, funnel summaries, tests.
- **Reports & Analytics:** Typed/parameterized reports, assessment/org analytics, smoke tests.
- **Tests & CI:** Core suites (assessments, licensing/finance, reports, sales), `ci:verify` wrapper, GitHub Actions workflow.

Tag the current commit as `v1.0.0-rc1` once CI (`pnpm ci:verify`) is green and production env vars are configured.

> Note: `v1.0.0` can point to the same commit after successful production validation.

## Phase 16 – Demo Packaging + Hardening (Signed Off)

- demo reset script: `pnpm demo:reset` with `DEMO_SEED=true` + login cheat sheet
- `docker-compose.dev.yml` + README local DB instructions
- Playwright smoke suite + CI Postgres provisioning + e2e run
- UX polish rollout (skeletons/empty states/formatters/toasts) across key pages
- certificate verify page (`/certificate/:number`) + seeded pass case + Playwright spec
- rate limiting + standardized auth error shape
- permission tests: center lead scoping, org manager assignment blocked, teacher payment blocked

Verification checklist:
- `pnpm --filter @lms/server test`
- `pnpm --filter @lms/server build`
- `pnpm --filter web build`
- `pnpm --filter @lms/web test:e2e`
- CI ✅ (main)
