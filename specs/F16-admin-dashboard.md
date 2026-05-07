# F16: Admin Dashboard

| | |
|---|---|
| **Phase** | 6 |
| **Sprint** | Sprint 6 |
| **Assigned to** | Dev C + Dev D (Frontend) + Dev A (Backend) |
| **Severity** | MAJOR |
| **Depends on** | F13, F14 |

## Summary

Admin overview showing submission status per user per week. The operational heart of the admin experience.

## Tasks & Subtasks

### 1. Backend: Dashboard data endpoint

- [ ] GET /admin/dashboard?year=&month= — returns matrix: rows=users, columns=weeks, cell=status (`not_started`/`draft`/`submitted`/`approved`/`rejected`/`missing`)
- [ ] **Status distinction**: `not_started` = no weekly_submission record AND Sunday deadline has not passed yet. `missing` = no submitted weekly_submission record AND `week_start_date + INTERVAL '7 days' < NOW() AT TIME ZONE 'Asia/Jerusalem'`. Both appear as 'no data' but with different colors and labels.
  > **Live missing computation**: the dashboard service computes `missing` dynamically via SQL CASE (rather than relying solely on the Sunday cron having run). SQL logic: `CASE WHEN ws.status = 'draft' AND ws.week_start_date + INTERVAL '7 days' < NOW() AT TIME ZONE 'Asia/Jerusalem' THEN 'missing' ELSE ws.status END`. This avoids race conditions between the cron and the live dashboard.
- [ ] Include summary counts: total users, submitted this week, missing, approved

### 2. Frontend: Admin dashboard

- [ ] AdminDashboard.jsx — default admin screen
- [ ] SubmissionStatusTable.jsx — matrix table with color-coded status per user per week
- [ ] Status colors: grey (not_started), dark-grey (missing), yellow (draft), blue (submitted), green (approved), red (rejected)
- [ ] Click cell → navigate to that user's week in report review
- [ ] Month selector
- [ ] **Week quick-jump**: clicking a week column header scrolls the view to that week and highlights it. Weeks outside the selected month are greyed out.
- [ ] Summary cards at top: total employees, submitted %, approved %, missing count
- [ ] Mobile responsive: stack into cards per user

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton matrix
- [ ] **Empty**: 'No users or no weeks for this month'
- [ ] **No-permission**: 403 if non-admin accesses dashboard
- [ ] **Server error**: toast on 500
- [ ] **Offline indicator**: matrix greys out with 'No internet' overlay

### 3. Tests

- [ ] Test: Dashboard data matches actual submission statuses
- [ ] Test: Only admin can access

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /admin/dashboard | Admin |

## Database Tables

weekly_submissions (read), users (read)

## Screens / UI

AdminDashboard, SubmissionStatusTable

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin desktop exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### AdminDashboard Page

**Layout:** standard management sidebar (`#1B2450`) + main content `background: #F3F4F6`

**KPI summary row** (top of page, 4–5 cards, flex):
- Card: `background: #FFFFFF`, `border-radius: 12px`, `padding: 20px`, box-shadow
- Colored icon SVG + large number `28–32px weight 800 #111827` + label `13px #6B7280`
- Cards: Total employees | Submitted weeks | Pending approval | Approved | Rejected

### SubmissionStatusTable / Matrix

**Table header** (dark navy `#1B2340`):
- First column (RTL right): "עובד" (employee name)
- Subsequent columns: week ranges (e.g. 01/10–07/10), `font: 14px white weight 600`
- Column header click: navigates to that week's review page

**Table rows** (white `#FFFFFF`, `height: 48–52px`):
- Employee cell: avatar circle (`32px`) + name `14px weight 600 #111827` + role `12px #6B7280`
- Week status cells: centered colored status badge

**Status cell color system:**

| Status | Background | Text | Label |
|---|---|---|---|
| not_started | `#E5E7EB` | `#6B7280` | לא התחיל |
| missing (auto-flagged) | `#D1D5DB` | `#374151` | חסר |
| draft | `#FEF3C7` | `#D97706` | טיוטה |

| approved | `#DCFCE7` | `#16A34A` | מאושר |
| rejected | `#FEE2E2` | `#EF4444` | נדחה |

> `not_started` (light grey `#E5E7EB`) and `missing` (darker grey `#D1D5DB`) must be visually distinct — different background shades and different label text.

**Clickable cells:** each week-status cell → navigates to ReportReviewPage filtered to that user + week

**Row hover:** `background: #EFF6FF`

**Pagination:** centered below table, blue active page pill (see figma-design-spec.md section 4.14)

## Files to Create/Modify

- `server/src/modules/dashboard/*`
- `client/src/features/admin/dashboard/*`

## Acceptance Criteria

- [ ] Matrix shows correct status for every user/week
- [ ] Click navigates to review
- [ ] Summary counts accurate
- [ ] 'not_started' (grey) and 'missing' (dark-grey) are visually distinct with different labels
- [ ] Week column header allows quick navigation to that week

