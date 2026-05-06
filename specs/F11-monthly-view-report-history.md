# F11: Monthly View & Report History

| | |
|---|---|
| **Phase** | 4 |
| **Sprint** | Sprint 4 |
| **Assigned to** | Dev C + Dev D (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F09 |

## Summary

Monthly calendar with day status indicators (full/missing/irregular). Detailed report list. Separate report history screen for browsing past months.

## Tasks & Subtasks

### 1. Backend: Monthly data endpoints

- [ ] GET /time-entries/monthly-summary?year=&month= — returns per-day summary: date, total hours, status (full/missing/irregular), entry count
- [ ] GET /time-entries/monthly-quota?year=&month= — returns: working days, holidays, absences, quota hours, reported hours, remaining
- [ ] **GET /reports/monthly-summary?user_id=&year=&month=** — returns KPI cards: `{ total_hours, vacation_days, sick_days, reserve_days, missing_days, week_statuses: [{week_start_date, status}], reported_projects: [{client, project, hours}] }`. Admin can pass any user_id; user can only query own.
- [ ] Include absence data in daily summaries

### 2. Frontend: Monthly view page

- [ ] MonthlyViewPage.jsx — calendar grid with day cells
- [ ] Each day cell: colored indicator for מלא (green), חסר (red), חריג (yellow)
- [ ] Click day → expand to show entries for that day
- [ ] Month/year navigator (prev/next arrows)
- [ ] **Week submission status pills**: group days into ISO Sunday-start weeks. Each week row shows a status pill: draft (grey) / submitted (blue) / approved (green) / rejected (red) / missing (dark red). Clicking pill navigates to WeeklySubmitBar for that week.
- [ ] QuotaProgressBar.jsx — X/Y hours reported this month
- [ ] Locked month banner: read-only mode indicator
- [ ] **"Modified by Admin" badge on DayDetailSheet**: when expanded day entries are shown, entries where `last_modified_by_role === 'admin'` display the badge (same as F09 TimeEntryCard)
- [ ] Below calendar: detailed entry list for selected day or entire month

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton calendar grid while data fetches
- [ ] **Empty**: days with no entries show as white/neutral (not error state)
- [ ] **Locked month**: all edit controls hidden; locked banner at top
- [ ] **Quota warning**: progress bar turns orange/red at 90%+
- [ ] **Offline indicator**: navigator buttons disabled with 'No internet' message
- [ ] **Server error**: toast on 500

### 3. Frontend: Report history page

- [ ] ReportHistoryPage.jsx — separate screen at route **`/reports/history`** (per original spec navigation)
  > Route should be registered in the app router as `/reports/history`.
- [ ] Browse previous months with month picker
- [ ] View all entries including locked months (read-only)
- [ ] Filter/search by client, project, task
- [ ] Different from monthly view: this is a flat list/table of all entries, not calendar-based

### 4. Tests

- [ ] Test: Day status correctly calculated (full when hours >= standard)
- [ ] Test: Monthly quota includes absence deductions
- [ ] Test: Locked month shows read-only

## API Endpoints


| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /time-entries/monthly-summary | User/Admin | Per-day summary: date, total hours, status, entry count |
| GET | /time-entries/monthly-quota | User/Admin | Quota: working days, holidays, absences, reported hours |
| GET | /reports/monthly-summary | User/Admin | KPI summary: total hours, absences (vacation/sick/reserve/missing), week statuses, reported projects |

## Database Tables

time_entries (read), absence_entries (read), holiday_calendar (read), month_locks (read)

## Screens / UI

MonthlyViewPage, MonthlyCalendar, QuotaProgressBar, ReportHistoryPage

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma webapp desktop exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

This feature **shares the same page and layout as F09**. The monthly view IS the daily report home page — it shows the full month at a glance via the KPI row and daily row list.

### Monthly View (same as F09 main screen)

**KPI row** — see F09 § KPI cards row. For monthly-specific values:
- "שעות חודשיות": total reported vs quota, e.g. "120 מתוך 180"
- Progress bar below KPI section: `height: 6px`, fill `#F59E0B`, track `#E5E7EB`, orange dot at endpoint
  - Right label: "X מתוך Y שעות"
  - Left label: "חסרות Z שעות לדיווח" `12px #666666`

### QuotaProgressBar Component

```
[progress track full width]
[•────────────────────────]
 120 מתוך 180 שעות          חסרות 60 שעות לדיווח
```
- Track: `height: 6px`, `background: #E5E7EB`, `border-radius: 9999px`
- Fill: `background: #F59E0B`, `border-radius: 9999px`, width = percentage
- Dot cursor: `8px × 8px` circle `background: #F59E0B` at fill endpoint
- Labels container: `display: flex; justify-content: space-between`, `margin-top: 6px`
- Label font: `12px, color: #666666`

### Locked Month State

- All daily rows show non-interactive chevrons (no tap action)
- Locked banner (top of daily list): `background: #FEF3C7`, `color: #D97706`, icon 🔒, text "החודש נעול — קריאה בלבד"
- `border-radius: 8px`, `padding: 12px 16px`, full content width

### Month Navigator (header)

- Same pill navigator as F09
- When navigating to past locked month: banner appears, row cards render but chevrons disabled
- When navigating to future month: all rows empty (placeholder rows per future weekday)

## Files to Create/Modify

- `client/src/features/time-reports/MonthlyViewPage.jsx`
- `client/src/features/time-reports/MonthlyCalendar.jsx`
- `client/src/features/time-reports/QuotaProgressBar.jsx`
- `client/src/features/time-reports/ReportHistoryPage.jsx`

## Acceptance Criteria

- [ ] Calendar shows correct day statuses
- [ ] Quota bar accurate
- [ ] History allows browsing past months
- [ ] Locked months are read-only
- [ ] Week submission status pill shows correct state per week
- [ ] Admin-modified entries show 'Modified by Admin' badge when day is expanded
- [ ] GET /reports/monthly-summary returns correct KPI figures

