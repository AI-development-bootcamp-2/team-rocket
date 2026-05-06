# F14: Admin Report Review & Approval

| | |
|---|---|
| **Phase** | 5 |
| **Sprint** | Sprint 5–6 |
| **Assigned to** | Dev A (Backend) + Dev C (Frontend) |
| **Severity** | CRITICAL |
| **Depends on** | F13 |

## Summary

Admin reviews submitted weeks, approves or rejects individual entries with mandatory reason. Per-week approval for easier month-end flow.

## Tasks & Subtasks

### 1. Backend: Approvals module

- [ ] GET /approvals/pending — list all submitted weeks across users, sorted by date
- [ ] POST /weekly-submissions/:id/approve — approve entire week, update all entries status=approved
- [ ] POST /time-entries/:id/reject — reject specific entry with mandatory reason. Entry status=rejected, returns to user for correction.
- [ ] POST /weekly-submissions/:id/reject — reject entire week with reason
- [ ] Rejection must include reason field (validated, non-empty)
- [ ] On reject: entry status → draft, user can edit and resubmit
- [ ] **On reject: call `notificationsService.create({ type: 'WEEK_REJECTED', userId, reason, weekStartDate })` to trigger in-app notification (F19)**
- [ ] **PUT /time-entries/:id (Admin role)**: Admin can directly edit any user's draft entry. Must include `version` field (optimistic lock from F09). On save: set `last_modified_by = admin_user_id`, `last_modified_by_role = 'admin'`. Audit log: action=ADMIN_EDIT, actor=admin, target=entry_id, old_value, new_value.
- [ ] All approve/reject actions audit logged with reason
- [ ] Email notification sent on rejection

### 2. Frontend: Report review page

- [ ] ReportReviewPage.jsx — admin view of all submitted weeks
- [ ] Filter by user, week, status (submitted/approved/rejected)
- [ ] WeeklyReviewCard.jsx — expandable card showing all entries for a week
- [ ] Each entry row: date, time, client/project/task, description, approve/reject buttons
- [ ] RejectReasonDialog.jsx — mandatory text input for rejection reason
- [ ] Bulk approve button for entire week
- [ ] Color coding: submitted (blue), approved (green), rejected (red)

### 2b. Required UI states (v3.2 §14.1)

- [ ] **Loading**: skeleton cards while fetching pending reviews
- [ ] **Empty**: 'No submitted weeks pending review'
- [ ] **Validation error**: reject dialog blocks submit if reason is empty
- [ ] **Save success**: entry row turns green on approve / red on reject
- [ ] **Server error**: toast on 500
- [ ] **Disabled control**: approve/reject buttons disabled for already-approved entries with tooltip

### 3. Frontend: User-side rejection view

- [ ] On DailyReportPage: rejected entries highlighted with red border
- [ ] Rejection reason displayed prominently
- [ ] Edit button to fix and resubmit
- [ ] **After correcting entries, user clicks 'Resubmit Week' button on WeeklySubmitBar. Calls `POST /weekly-submissions/:id/resubmit` (defined in F13). Button enabled only when all previously-rejected entries have been corrected (status=draft). Shows confirmation dialog.**

### 4. Tests

- [ ] Test: Approve updates all entry statuses
- [ ] Test: Reject without reason returns 400
- [ ] Test: Rejected entry returns to draft
- [ ] Test: User can edit and resubmit rejected entries
- [ ] Test: All actions audit logged

## API Endpoints


| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /approvals/pending | Admin |
| POST | /weekly-submissions/:id/approve | Admin |
| POST | /weekly-submissions/:id/reject | Admin |
| POST | /time-entries/:id/reject | Admin |

## Database Tables

weekly_submissions, time_entries (status update), audit_logs

## Screens / UI

ReportReviewPage, WeeklyReviewCard, RejectReasonDialog

## UI/UX — Pixel-Perfect Design Reference

> Source: Figma management admin desktop exports. Tokens updated per Figma MCP extraction. Full token reference: `specs/figma-design-spec.md`

### ReportReviewPage

**Layout:** standard management portal layout (sidebar `#1B2450` + main content `background: #F3F4F6`)

**Page header:**
- Title: "סקירת דוחות" `22–24px weight 700 #111827`
- Subtitle: `13px #6B7280`
- Action row: search input + filter dropdowns (week, user, status)

**Filter toolbar:**
- Search input: `width: ~240px`, `height: 40px`, magnifier icon right (RTL), `border: 1px solid #E0E0E0`, `border-radius: 8px`
- Dropdowns: `height: 36px`, `border: 1px solid #E0E0E0`, `border-radius: 8px`, chevron on left (RTL)

**WeeklyReviewCard** (one per user-week):
- White card `border-radius: 8px`, `border: 1px solid #E5E7EB`, `padding: 0`
- Card header row `height: 52px`, `background: #F9FAFB`, `border-bottom: 1px solid #E5E7EB`:
  - Right: employee name `14px weight 600` + avatar circle
  - Center: week range label `13px #6B7280`
  - Left: status badge + [Approve] + [Reject] action buttons
- Approve button: `background: #16A34A`, `height: 32px`, `border-radius: 6px`, white text "אשר"
- Reject button: `background: #EF4444`, white text "דחה"
- Expand chevron: on left end

**Expanded week entries** (table inside card):
- Column headers: `background: #1B2340`, white text, `font: 14px weight 600, height: 40px`
- Body rows: `height: 44px`, `border-bottom: 1px solid #F3F4F6`
- "Modified by Admin" badge: `background: #FEF3C7, color: #D97706` "עודכן ע"י מנהל"

**Status badges:** same color system as figma-design-spec.md section 4.12

### RejectReasonDialog

**Layout:** centered modal, ~500px wide, `border-radius: 12px`, overlay `rgba(0,0,0,0.45)`

**Content:**
- Title: "סיבת דחייה" `22px weight 700`
- Employee name + week label `13px #6B7280`
- Rejection reason dropdown (predefined reasons): `height: 48px`, full-width
- Free-text textarea: "הוספת הערה" placeholder, `min-height: 80px`
- Buttons: [Cancel `#6B7F9E`] + [Send rejection `#EF4444`]
  - Both `height: 44px`, `border-radius: 8px`

## Files to Create/Modify

- `server/src/modules/approvals/*`
- `client/src/features/admin/reports-review/*`

## Acceptance Criteria

- [ ] Admin sees all submitted weeks
- [ ] Can approve per week or reject per entry
- [ ] Rejection requires reason
- [ ] User sees rejection and can correct
- [ ] After correction, user can resubmit via 'Resubmit Week' button (calls F13 resubmit endpoint)
- [ ] Admin direct edit sets last_modified_by_role='admin' and creates ADMIN_EDIT audit log entry
- [ ] Rejection triggers in-app notification to the user

