# F13: Weekly Submission

| | |
|---|---|
| **Phase** | 5 |
| **Sprint** | Sprint 5 |
| **Assigned to** | Dev A (Backend) + Dev C (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F09, F12 |

## Summary

Mandatory weekly submission. User submits when all days are allocated. Auto-flag as Missing if not submitted by Sunday 23:59. Blocks editing after submission.

## Tasks & Subtasks

### 1. Backend: Weekly submissions module

- [ ] GET /weekly-submissions — list by user, month. Admin: all users. User: own.
- [ ] GET /weekly-submissions/:id — details with linked entries
- [ ] POST /weekly-submissions/:weekId/submit — validate all working days fully allocated (9h standard - absences), set status=submitted, set all entries status=submitted. Block if timer running. **Block if monthly total hours > system setting `MONTHLY_QUOTA_HOURS` — return 422 `{ error: 'QUOTA_EXCEEDED', monthly_total, quota }`.** **Partial-day absence validation gate**: for each day in the week with `is_partial=true` absence, verify that `SUM(time_entry.duration_minutes) + absence_hours >= DAILY_STANDARD_HOURS`. If not: return 422 `{ error: 'PARTIAL_ABSENCE_UNCOVERED', date, missing_hours }`. **Sick/reserve document gate**: if week contains any `sick` or `reserve` absence record without an attached document, return 422 `{ error: 'SICK_RESERVE_DOCUMENT_REQUIRED', absence_id }`. Note: admin exception path is not implemented in v1 — admin must unlock or adjust entries first.
- [ ] **POST /weekly-submissions/:id/resubmit** — available when week status=rejected. Validates: all previously-rejected entries are now in status=draft (corrected). Sets week status back to 'submitted'. Audit logged: action=WEEK_RESUBMITTED.
- [ ] **Weekly submission record creation**: record is created lazily on the first time_entry save for that Sun–Sat window. `week_start_date` is always the Sunday of that ISO week (JS: `date - date.getDay()` where Sunday=0). Upsert pattern — no duplicate records per user+week.
- [ ] Cron job: **Sunday 23:59 Israel time** (`cron.schedule('59 23 * * 0', checkMissingSubmissions, { timezone: 'Asia/Jerusalem' })`).
  > The cron must query **all active users**: `SELECT id FROM users WHERE is_active = true`. For each user, check whether a `weekly_submission` record for the current week exists AND has `status` other than `draft`. If not: upsert a record with `status='missing'` for that user+week. Do NOT iterate only existing `weekly_submissions` rows — users who never created an entry would be skipped.
  > After upserting: `await notificationsService.create({ type: 'MISSING_REPORT', userId, relatedEntityType: 'WEEKLY_SUBMISSION', relatedEntityId: weeklySubmission.id })`.
  > `WEEKLY_SUBMISSION_DEADLINE_DAY` (system setting) specifies the deadline day. **Option A (v1)**: treat as read-only after initial setup; changing the value requires a server restart. Dynamic rescheduling is not implemented in v1.
- [ ] **Week start day**: always Sunday (Israel work week). `week_start_date` column stores the Sunday date. All cron queries and UI week grouping use Sunday-to-Saturday window.
- [ ] Validate: cannot submit if any day has validation errors (overlap, missing hours, invalid entries)
- [ ] Submitted entries become read-only unless rejected by admin
- [ ] Audit log: submission event

### 2. Frontend: Weekly submission UI

- [ ] WeeklySubmitBar.jsx — shown on daily report page and monthly view
- [ ] Shows week status: draft / ready / submitted / approved / rejected / missing
- [ ] Submit button: enabled only when all days are fully allocated and valid
- [ ] Disabled state with explanation tooltip if not ready
- [ ] Confirmation dialog before submission
- [ ] Success toast after submission
- [ ] Warning banner if timer is running: 'Stop timer before submitting'
- [ ] Missing week notification (after Sunday deadline)

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: spinner on submit button while request is in flight
- [ ] **Disabled control**: Submit button disabled with specific reason tooltip (e.g. 'Day 2026-05-04 is under-reported', 'Timer is running', 'Quota exceeded')
- [ ] **Submit success**: green checkmark + toast 'שבוע הוגש בהצלחה'
- [ ] **Rejection notice**: red banner with admin reason; Resubmit button enabled after correction
- [ ] **Missing**: dark-red banner 'השבוע לא דווח במועד — חסר'
- [ ] **Quota exceeded**: toast on 422 response with specific hours overage
- [ ] **Server error**: toast on 500

### 3. Tests

- [ ] Test: Cannot submit with under-allocated days
- [ ] Test: Cannot submit with running timer
- [ ] Test: Submission locks entries from editing
- [ ] Test: Auto-flag Missing on deadline (Sunday 23:59 IL)
- [ ] Test: Submission event audit logged
- [ ] **Test: week_start_date is always a Sunday**
- [ ] **Test: Lazy record creation — first time_entry for a week creates the weekly_submission record**
- [ ] **Test: Resubmit endpoint — week moves from rejected → submitted**
- [ ] **Test: Resubmit blocked if week is not in rejected status**
- [ ] **Test: Submit blocked if monthly_total > MONTHLY_QUOTA_HOURS**

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /weekly-submissions | User/Admin |
| GET | /weekly-submissions/:id | User/Admin |
| POST | /weekly-submissions/:id/submit | User |
| POST | /weekly-submissions/:id/resubmit | User |

## Database Tables

weekly_submissions, time_entries (status update)

## Screens / UI

WeeklySubmitBar (component), SubmitConfirmDialog

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma webapp desktop exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### WeeklySubmitBar Component

Displayed **above** the daily row list, once per current week block.

**Layout (RTL, white card `border-radius: 12px`, `padding: 14px 16px`):**
```
[Submit week button]     [Week range label]   [Status badge]   [Week title]
```

**Status badges:**
- Not started: `background: #E5E7EB, color: #050804` — "לא הוגש"
- Draft: `background: #FEF3C7, color: #D97706` — "טיוטה"
- Submitted: `background: #DBEAFE, color: #2563EB` — "הוגש לבדיקה"
- Approved: `background: #DCFCE7, color: #16A34A` — "מאושר"
- Rejected: `background: #FEE2E2, color: #EF4444` — "נדחה"
- **Missing: `background: #FDB5BC, color: #991B1B` — "חסר — לא דווח במועד"**
  > When status is `missing`: Submit button is **hidden** (not disabled). A dark-red banner is shown: `background: #FDB5BC, border: 1px solid #991B1B, border-radius: 8px, color: #991B1B` — "שבוע זה לא דווח במועד ולא ניתן להגישו".

**Submit button:**
- Active: `background: #142A3F`, `height: 36px`, `border-radius: 8px`, white text "הגש שבוע"
- Disabled (incomplete): `background: #9CA3AF`
- Submitted/approved: button hidden or shows "הוגש" static label

**Rejection indicator:**
When week is rejected: amber rejection banner below WeeklySubmitBar:
- `background: #FEF3C7`, `border: 1px solid #D97706`, `border-radius: 8px`
- Left: rejection reason text `14px #050804`
- Right: pencil icon + "תקן ושלח מחדש" `#6B2FAA` link

### SubmitConfirmDialog

**Layout:** centered modal, ~420px wide, white, `border-radius: 12px`, overlay `rgba(0,0,0,0.45)`

**Content:**
- Icon: blue calendar/checkmark SVG `48×48px`
- Title: "להגיש את שבוע X–Y?" `22px weight 700 #111827`
- Body: week summary (days reported, total hours, projects count) `14px #6B7280`
- Buttons: [Cancel: `background: #6B7F9E`] + [Confirm: `background: #142A3F`]
  Both: `height: 48px`, `border-radius: 8px`, white text
  Button row: `display: flex; gap: 12px` (RTL: Cancel right, Submit left)

**If incomplete:** warning variant — amber icon, body lists missing entries

## Files to Create/Modify

- `server/src/modules/weekly-submissions/*`
- `client/src/features/time-reports/WeeklySubmitBar.jsx`

## Acceptance Criteria

- [ ] Submit only when fully allocated
- [ ] Timer blocks submission
- [ ] Entries locked after submit
- [ ] Missing auto-flagged (Sunday 23:59 Israel time)
- [ ] Resubmit endpoint available after rejection; moves week back to submitted
- [ ] week_start_date always stores the Sunday of the week
- [ ] Weekly submission record auto-created on first entry save for that week
- [ ] Submit blocked when monthly quota exceeded

