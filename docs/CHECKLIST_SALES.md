# Sales Role Feature Checklist

1) Dashboard (if applicable)
   - Sales dashboard backend endpoints exist: ❌
   - Dashboard UI exists: ❌
   - Funnel summary visible (if sales shares BP funnel): ⚠️
   - Lead performance summary: ❌

2) Lead Management
   - View leads list: ❌
   - Lead creation backend route exists: ❌
   - Lead creation UI exists: ❌
   - Edit/update lead status: ❌
   - Lead stage transitions (NEW → CONTACTED → TRIAL_BOOKED → TRIAL_DONE → CONVERTED/LOST): ⚠️
   - Lead detail view page: ❌

3) Lead Analytics
   - Backend analytics available:
       - /api/analytics/sales/bp-funnel or role-specific: ✔️
   - Frontend funnel component exists for SALES: ❌
   - Date-range filtering: ⚠️

4) Permissions & Scope
   - Sales role scoping in requireRole or RBAC: ❌
   - Can only view/edit their assigned leads: ❌
   - Prevented from accessing BP/Superadmin analytics: ⚠️

5) Communication
   - Add notes on leads: ❌
   - Assign leads to BP/Franchise/Center (if supported): ❌
   - Notification/alert UI (if exists): ❌

6) Reports
   - Lead conversion reports: ❌
   - Sales performance reports: ❌
   - Export/download (if exists): ❌
