## Environment Variables

These values must be configured before running the stack. Keep secrets out of version control.

### Server (`apps/server`)
- `DATABASE_URL` – Postgres connection string (required).
- `JWT_SECRET` – JWT signing secret (required in production; tests/dev default to `testsecret123456`).
- `PORT` – API port (default 9000).
- `NODE_ENV` – `development` | `production` | `test`.
- `FRONTEND_URL` – Base URL used in links (default `http://localhost:5173`).
- SMTP (optional; warned if missing):
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Optional feature flags:
  - `MAINTENANCE_MODE` – `true` | `false`

### Web (`apps/web`)
- `VITE_API_BASE_URL` – Base URL for API calls (default is relative `/api` when unset).
- `VITE_ENV` or similar flags if you introduce new build-time toggles (none required today).

### Notes
- In dev/test the server uses sensible defaults where safe. In production, provide real secrets/URLs.
- Missing non-critical values (SMTP, FRONTEND_URL overrides) should log a warning but not crash dev/test.
