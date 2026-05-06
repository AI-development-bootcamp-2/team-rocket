# Epic 5 — Admin Operations & Polish

> **Days**: Day 6 | **Priority**: HIGH (F15, F16) / MEDIUM (F17, F18) / LOW (F19)  
> **Goal**: Lock months, export data, dashboard overview, audit trail  
> **Features**: F15, F16, F17, F18*, F19*

> ⚠️ F18 (Export) and F19 (Notifications + Holiday Settings) are **best-effort only** — ship if Epics 1–4 are solid.

---

## Features

| ID | Feature | Lead | Priority |
|----|---------|------|---------|
| F15 | Month Lock / Unlock | Dev A + Dev D | HIGH |
| F16 | Admin Dashboard | Dev C | HIGH |
| F17 | Audit Log — BE + FE | Dev B + Dev D | MEDIUM |
| F18 | Export Excel / PDF | Dev A* | MEDIUM (best-effort) |
| F19 | Notifications + Holiday Settings | Dev B* | LOW (best-effort) |

---

## F15 — Month Lock / Unlock

### Business Rules (CRITICAL)

- Admin locks a month **only after all users' monthly submissions for that month are approved**
- Locking blocks **all editing** for all users for that month (time entries, absences)
- Final **payroll export auto-locks** the month
- Admin can **reopen a locked month** — must provide a reason, action is audit logged
- Reopening returns all entries to their pre-lock status

### Lock / Unlock Flow

**Lock:**
1. Admin selects year + month on the Month Lock screen
2. System checks: does every user have a monthly submission with status `approved` for this month?
3. If not: show list of users whose monthly submission is not yet approved, with their current status
4. Admin confirms → month is locked → `month_locks.is_locked = true`
5. All users see "Month X is locked" banner on their monthly view

**Unlock / Reopen:**
1. Admin selects a locked month
2. Admin must enter a **mandatory reason** for reopening
3. Confirm → month unlocked → entries return to pre-lock status
4. Audit log: who reopened, reason, timestamp

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/months` | Admin | List months with lock status |
| POST | `/months/:yearMonth/lock` | Admin | Lock a month |
| POST | `/months/:yearMonth/unlock` | Admin | Unlock a month (requires reason) |
| GET | `/months/:yearMonth/status` | Admin | Get monthly submission approval status per user |

#### Lock Request

```json
// POST /months/2026-04/lock
// No body required
// 400 Bad Request if unapproved monthly submissions exist:
{
  "error": "3 users have not yet been approved for this month",
  "unapprovedUsers": [
    { "userId": "...", "userName": "...", "submissionStatus": "submitted" },
    { "userId": "...", "userName": "...", "submissionStatus": "rejected" },
    { "userId": "...", "userName": "...", "submissionStatus": "missing" }
  ]
}
```

#### Unlock Request

```json
// POST /months/2026-04/unlock
{ "reason": "Employee requested correction of sick leave record" }
```

### DB Table

```sql
month_locks
  id UUID PK
  year INT NOT NULL
  month INT NOT NULL
  locked_by UUID FK → users
  locked_at TIMESTAMPTZ
  unlocked_by UUID FK → users
  unlocked_at TIMESTAMPTZ
  is_locked BOOLEAN DEFAULT FALSE
  unlock_reason TEXT
  UNIQUE(year, month)
```

### UI

- Month selector (dropdown or calendar picker)
- Status per user (monthly submission): approved / submitted / rejected / missing / draft
- Lock button (disabled if any user's monthly submission is not `approved`)
- Locked state: "Unlock Month" button with required reason input

---

## F16 — Admin Dashboard

### What to Display (MAJOR)

The admin dashboard is the **operational heart** of the admin experience — without it, the admin has no way to know who needs follow-up.

**Submission status table** showing, for each user, their monthly submission status for the selected month:

| User | Monthly Submission Status |
|------|--------------------------|
| Name | Status chip |

**Status chips:**
- 🔘 Not started (grey)
- 🔵 In progress (blue)
- 🟡 Submitted — awaiting review (yellow)
- 🟢 Approved (green)
- 🔴 Rejected (red)
- 🟠 Missing (orange)

**Summary counts at top:**
- Submitted (awaiting review): N
- Rejected (awaiting correction): N
- Missing (overdue): N

**Quick actions:**
- Click a row → go to that user's monthly review screen
- Click "Pending Reviews" count → filtered list of submitted monthly submissions

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard?year=&month=` | Admin | Submission status for all users for a month |

#### Response

```json
{
  "month": "2026-05",
  "users": [
    {
      "userId": "uuid",
      "userName": "שם עובד",
      "monthlySubmission": {
        "id": "uuid",
        "status": "submitted",
        "submittedAt": "2026-05-28T18:00:00Z"
      }
    },
    {
      "userId": "uuid",
      "userName": "שם עובד 2",
      "monthlySubmission": {
        "id": "uuid",
        "status": "approved",
        "submittedAt": "2026-05-27T10:00:00Z"
      }
    }
  ],
  "summary": { "pendingReview": 5, "rejected": 2, "missing": 3 }
}
```

---

## F17 — Audit Log

### Events That Must Be Logged (CRITICAL)

Every one of the following must create an `audit_logs` record:

| Event | Action |
|-------|--------|
| Login success | `login` |
| Failed login attempt | `loginFail` |
| Create / edit / archive: time entry, absence, client, project, task, user, assignment | `create` / `update` / `delete` / `archive` |
| Submit monthly report | `submit` |
| Approve entry or monthly submission | `approve` |
| Reject entry or monthly submission (including reason) | `reject` |
| Resubmission after rejection | `submit` |
| Reopen locked month (including reason) | `reopen` |
| Change user role / grant or revoke permission flag | `update` |
| Export report | `export` |
| Upload / remove absence document (especially after lock) | `update` |
| Admin edit of another user's report | `update` |
| Deactivate / reactivate user | `update` |
| Password reset (by admin or user) | `update` |

### Implementation Approach

Use a **middleware layer** (planned in F03 auth middleware) to intercept all state-changing API calls and automatically write audit records. This avoids manual logging in every service.

### Audit Log Record Schema

```json
{
  "id": "uuid",
  "actorUserId": "uuid",
  "targetEntityType": "timeEntry",
  "targetEntityId": "uuid",
  "action": "reject",
  "oldValue": { "status": "submitted" },
  "newValue": { "status": "rejected" },
  "reason": "Hours don't match project log",
  "timestamp": "2026-05-06T14:00:00Z",
  "ipAddress": "1.2.3.4"
}
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audit-logs` | Admin | Filterable audit log list |

#### Filters

```
GET /audit-logs?
  actorUserId=uuid
  &targetEntityType=timeEntry
  &action=reject
  &from=2026-05-01
  &to=2026-05-31
  &page=1
  &limit=50
```

### Admin Audit Log Viewer

- Filterable table: by entity type, action, user, date range
- Each row shows: timestamp, actor, action, target entity, reason (if applicable)
- Click row → expand to see old/new values (JSON diff view)

---

## F18 — Export Excel / PDF (best-effort)

### Business Rules (MAJOR)

- Only Admin can export
- Export formats: **Excel (.xlsx)** and **PDF**
- Admin CAN export an **unapproved month**, but document must show **"NOT APPROVED"** watermark
- Final payroll export of an approved month **auto-locks that month**
- Every export includes: digital timestamp + ID of the generating admin
- Every export action is **audit logged**

### Export Filters

| Filter | Description |
|--------|-------------|
| Month | Primary dimension (required) |
| User | Filter by one or all users |
| Project | Filter by project |
| Client | Filter by client |
| Format | xlsx or pdf |

### Export Contents (per row)

date, start time, end time, duration, client, project, task, location, description, absence type (if applicable), approval status, correction history (if entry was rejected and resubmitted)

### Performance

- Export generation: < 30 seconds for full-month all-users export
- Libraries: `json2csv` / `exceljs` for Excel; `jsPDF` or `pdfkit` for PDF

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/exports` | Admin | Generate and download export |

```
GET /exports?month=2026-05&userId=all&format=xlsx
```

---

## F19 — Notifications + Holiday Settings (best-effort)

### In-App Notifications (MAJOR)

| Trigger | Notification |
|---------|-------------|
| Admin rejects entry | User sees rejection reason in notification inbox |
| Month locked | Banner on user's monthly view |
| Missing report (no entries on working day) | Alert on daily view |
| Monthly quota approaching limit | Warning on quota progress bar |
| Admin edits user's report | Visual "Modified by Admin" badge on entry |

### Email Notifications (MAJOR)

Only 2 email triggers for v1:
1. **Missing monthly report**: email sent on the last working day of the month if the monthly submission has not yet been submitted
2. **Admin rejection**: email sent when admin rejects any of the user's entries

No other emails in v1 (keep volume minimal to avoid spam fatigue).

### Holiday Calendar / Work Settings (MAJOR)

Admin must be able to configure:
- **Holidays**: add/remove specific dates as non-working days (name + type: holiday/special)
- **Standard hours**: default is 9h/day (configurable per day or globally)

#### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/holidays` | Admin | List holiday calendar |
| POST | `/settings/holidays` | Admin | Add a holiday |
| DELETE | `/settings/holidays/:id` | Admin | Remove a holiday |
| GET | `/settings/calendar` | Admin | Get work schedule settings |
| PUT | `/settings/calendar` | Admin | Update standard hours / non-working day config |

#### Holiday Settings UI

- Calendar view with existing holidays highlighted
- "Add Holiday" form: date picker + name + type (holiday / special)
- Settings panel: default daily standard hours, non-working days (checkboxes: Sun–Sat)

---

## Test Plan

| Category | What to test | Priority |
|----------|-------------|---------|
| Integration | Month lock blocked if any user's monthly submission is not approved | CRITICAL |
| Integration | Locked month rejects all edits for all users | CRITICAL |
| Integration | Unlock requires reason, creates audit log | CRITICAL |
| Integration | Payroll export auto-locks month | MAJOR |
| Audit | Every auditable event from F17 list creates correct record | MAJOR |
| Audit | Audit log records include old + new values on updates | MAJOR |
| Audit | Rejection reason stored in audit log | MAJOR |
| Export | Excel/PDF output contains all required fields | MAJOR |
| Export | Unapproved export shows "NOT APPROVED" watermark | MAJOR |
| Export | Export action creates audit log | MAJOR |
| Notification | Missing month triggers email on last working day of month if not submitted | MINOR |
| Notification | Admin rejection triggers in-app + email notification | MINOR |
| Settings | Adding a holiday removes it from working day count in quota calc | MAJOR |
