## Known Limitations (Current Release)

- **Security extras:** No MFA, no per-device session management, limited rate-limiting beyond route guards.
- **Payments/finance:** No payment gateway integration; finance is limited to fee records + transactions and summaries (no refunds/reconciliation automation).
- **Assessments:** Exams lack timers/proctoring/section randomization; worksheets lack autosave/time tracking; accessibility needs a full sweep.
- **Performance at scale:** Dashboards and reports have not been load-tested with very large org trees or datasets; pagination is basic in some views.
- **Org tooling:** Org tree editing/audits are minimal; admin UX could be more robust.
- **Ops:** CI config is provided, but production secrets/monitoring/backups must be set up externally; /api/health should be monitored in production.
