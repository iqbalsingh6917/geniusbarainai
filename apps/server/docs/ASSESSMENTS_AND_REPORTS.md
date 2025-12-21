## Overview

This backend powers assessments (exams + worksheets), licensing/finance summaries, and reporting/analytics used by the dashboards.

### Assessment data flow
- **Exams:** `Exam`, `ExamQuestion`, `ExamOption`, `ExamAttempt`, `ExamAnswer`.
- **Worksheets:** `WorksheetQuestion`, `WorksheetOption`, `StudentWorksheetAttempt`, `StudentWorksheetAnswer`.
- **APIs:** Student delivery (`/api/student/exams/...`, `/api/student/worksheets/...`), teacher review (`/api/teacher/exams/attempts...`, `/api/teacher/worksheets/review/...`), analytics (`/api/superadmin/analytics/assessments/summary`, `/api/teacher/analytics/assessments/summary`).

### Leads / Licensing / Finance in dashboards
- **Leads:** `Lead` + `LeadActivity`, exposed via `/api/bp/leads/summary`, `/api/leads`.
- **Licensing:** `CourseLicense`, `LicenseAllocation`, enforced capacity/expiry in licensing service and `/api/seat-allocations`.
- **Finance:** `StudentFeeRecord` and `PaymentTransaction` feed org/superadmin finance summaries and org dashboards.

## Tests
- Assessments (exams + worksheets):  
  `pnpm --filter @lms/server test:assessments`

- Licensing & finance:  
  `pnpm --filter @lms/server test:licensing-finance`

- Reports / analytics smoke:  
  `pnpm --filter @lms/server test:reports`

- Full backend core sweep (all of the above):  
  `pnpm --filter @lms/server test:all-core`

## Reports
- Legacy reports routes are now typed and exercised by `test:reports`. Paths and response shapes are unchanged to keep dashboards stable.

## Migrations / setup
- Apply Prisma migrations and generate client from repo root:  
  `pnpm --filter @lms/db prisma migrate dev`  
  `pnpm --filter @lms/db prisma generate`

## Roles (high level access)
- **SUPERADMIN:** full access, reports, finance, leads, licensing.
 - **BUSINESS_PARTNER / FRANCHISE / CENTER_MANAGER:** scoped by `getAllowedOrgUnitsForUser` for dashboards, leads, finance.
- **TEACHER:** scoped by teacher assignments + org units for assessments analytics/review.
- **STUDENT:** limited to own learning/attempt APIs.
