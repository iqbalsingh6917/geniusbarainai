# Aider Workflow for Beats LMS

## 1) Prerequisites
- Python 3.11+ with aider installed.
- `OPENAI_API_KEY` set in your environment.
- Git initialized with a clean working tree.
- Typical setup:
  - Activate env: `E:\geniusbrainai\aider-3-11\Scripts\Activate.ps1`
  - Change to repo: `cd E:\geniusbrainai\beats-lms-v2`

## 2) Starting Aider
- From the repo root:
  - `aider .`
- This loads the entire project working tree (apps/server, apps/web, packages/db, docs).

## 3) Basic Commands
- Restrict edits to specific files:
  - “Only modify apps/server/src/modules/learning/moduleAttempt.service.ts and apps/server/src/routes/moduleAttempts.routes.ts”
- View diffs: `/diff`
- Undo last change: `/undo`
- Toggle auto-commit:
  - `/set auto-commit on`
  - `/set auto-commit off`

## 4) Typical Tasks for This Project
- Backend examples:
  - “Update the seat allocation service to adjust remaining seats logic.”
  - “Add a new API under apps/server/src/routes for franchise dashboard.”
- Frontend examples:
  - “Wire a new dashboard widget in SuperadminDashboardReal.tsx to call /api/licensing/summary.”
- DB examples:
  - “Modify schema.prisma and then remind the user to run `pnpm --filter @lms/db run migrate:dev`.”

## 5) Safety Notes
- Always run `git status` before and after using Aider.
- Recommended pattern:
  - Commit before big AI changes.
  - Use `/diff` to review.
  - Commit after verifying the app still builds.

## 6) Integration with Codex
- Codex is used to design bigger changes.
- Aider is used to apply/manage patches and edits inside the repo.*** End Patch" json-editor="apply_patch_code" classification-confidence="0.83" vision-info="none" ***!
