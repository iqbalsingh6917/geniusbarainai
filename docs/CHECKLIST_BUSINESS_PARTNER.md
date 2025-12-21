# Business Partner Feature Checklist

1) Dashboard
   - Lead funnel (NEW, CONTACTED, TRIAL_BOOKED, TRIAL_DONE, CONVERTED, LOST) wired to /api/analytics/sales/bp-funnel: ✔️
   - Source funnel (CAMPAIGN, REFERRAL, WALK_IN, WHATSAPP, OTHER) wired to backend: ✔️
   - Date-range filtering on funnel: ⚠️
   - Network summary (franchises/centers under BP): ✔️
   - Quick actions routing from BP dashboard: ❌
   - Phase 1 highlight message visible for BP: ✔️

2) Licensing (BP scope)
   - View BP-owned licenses: ❌
   - Allocate seats from BP to franchises/centers: ⚠️
   - Seat allocation error handling (INVALID_SEAT_COUNT, NO_ACTIVE_LICENSE, INSUFFICIENT_SEATS) surfaced in UI: ❌
   - View seat allocations under BP: ❌

3) Org Management
   - View franchises under BP: ⚠️
   - View centers under BP: ✔️
   - Add/edit org units under BP (if allowed): ❌
   - User management under BP scope (view/add/edit users): ❌

4) Students & Enrollments
   - View students within BP network: ❌
   - View enrollments under BP: ❌
   - Enrollment creation by BP (allowed or not): ❌

5) Curriculum Access
   - View courses/curriculum available under BP: ❌
   - Ability to edit curriculum (should likely be ❌): ❌

6) Leads / Sales
   - Lead list for BP: ❌
   - Lead creation/editing for BP: ❌
   - BP funnel analytics backend implementation: ✔️
   - BP dashboard integration with funnel: ✔️

7) Reports & Finance
   - Licensing usage summary under BP: ❌
   - Dues/payments visibility under BP: ❌
   - Access to reports pages (if any): ❌
