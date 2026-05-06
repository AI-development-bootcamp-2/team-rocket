# Epic 4 — Submission & Approval Lifecycle

> **Days**: Day 5 | **Priority**: CRITICAL  
> **Goal**: Monthly submit → admin approves/rejects → month locked  
> **Features**: F10 (Timer), F13 (Monthly Submission), F14 (Approval/Rejection)

---

## Features

| ID | Feature | Lead |
|----|---------|------|
| F10 | Timer — Full-stack | Dev B |
| F13 | Monthly Submission — BE + FE | Dev A (BE), Dev C (FE) |
| F14 | Approval/Rejection — BE + FE | Dev B (BE), Dev D (FE) |

**Milestone**: Full lifecycle works — employee submits month → admin reviews → approved or rejected.

---

## Reporting Lifecycle — State Machine (CRITICAL)

### Status Definitions

| Status | Meaning | Triggered by | Editable? |
|--------|---------|-------------|---------|
| Draft | Saved but month not submitted | User saves an entry | ✅ Yes |
| Missing | No report for working day, or month not submitted by deadline | System auto-flag (last working day of month, 23:59) | ✅ Yes (user must fix and submit) |
| Invalid | Entry has validation errors | System validation | ✅ Yes (user must fix) |
| Ready to Submit | All days in month fully allocated and valid | System (auto-detected) | ✅ Yes (until submitted) |
| Submitted | User submitted the month | User clicks Submit | ❌ No (unless rejected/reopened) |
| Approved | Admin approved | Admin | ❌ No |
| Rejected | Admin rejected with reason | Admin | ✅ Yes (user corrects and resubmits) |
| Locked | Month closed | System (after approval + export) | ❌ No (unless Admin reopens) |

### Lifecycle Flows

**Normal flow:**
```
Draft → Ready to Submit → Submitted → Approved → Locked
```

**Rejection flow:**
```
Submitted → Rejected → Draft → Submitted → Approved → Locked
```

**Auto-flag:**
```
If last working day of month at 23:59 arrives and month not submitted → Missing
```

**Reopen:**
```
Admin reopens Locked month → entries return to pre-lock status
```

---

## F13 — Monthly Submission

### Business Rules (CRITICAL)

- Monthly submission is **mandatory** — it's the checkpoint that says "I finished reporting this month"
- Before submission is allowed, **every working day in the entire month must be fully allocated** (= 9h or configured standard across all entries + absences)
  - If any day is incomplete: Submit button is disabled with tooltip explanation
- **Deadline**: last working day of the month at 23:59 — if not submitted by then, month is auto-flagged as `Missing`
- After submission: user **cannot edit** that month's entries unless Admin rejects them or reopens the month
- Admin receives the submission and can review at any time

### Submit Button Logic

```
Submit is enabled ONLY when:
  - All working days in the month have entries
  - Total hours per day ≥ daily standard (or absence covers the gap)
  - No running timer
  - No validation errors on any entry
```

### Timer Check
If a timer is running, monthly submission is **blocked** with message:
> "You have a running timer. Stop it before submitting."

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/monthly-submissions` | User (own) / Admin (any) | List submissions (filter: user_id, year, month, status) |
| GET | `/monthly-submissions/:id` | User (own) / Admin (any) | Get single submission |
| POST | `/monthly-submissions/:id/submit` | User | Submit month |
| GET | `/monthly-summary?userId=&year=&month=` | User (own) / Admin | Get month status + quota progress |

#### Submit Request

```json
// POST /monthly-submissions/:id/submit
// No body required — submits all entries for the current month
// Returns: { status: "submitted", submittedAt: "2026-05-31T12:00:00Z" }
```

### DB Table

```sql
monthly_submissions
  id UUID PK
  user_id UUID FK → users
  year INT NOT NULL
  month INT NOT NULL          -- 1–12
  status ENUM('draft', 'missing', 'submitted', 'approved', 'rejected') DEFAULT 'draft'
  submitted_at TIMESTAMPTZ
  reviewed_by UUID FK → users
  reviewed_at TIMESTAMPTZ
  rejection_reason TEXT
  UNIQUE(user_id, year, month)
```

### Frontend Components

- **MonthlySubmitButton**: prominent button on the monthly view screen
  - Shows: month's total hours, remaining hours, quota progress bar
  - Submit button with correct enabled/disabled state
  - Running timer warning (if applicable)

- **QuotaProgressBar**: visual progress of hours reported vs. quota
  - Green: on track
  - Yellow: approaching quota
  - Red: at or above quota

- **Submit confirmation dialog**: "Submit May 2026? You won't be able to edit after this."

---

## F14 — Approval & Rejection

### Admin Approval Business Rules (CRITICAL)

- Admin approves **one monthly submission per user** — a single action covers the entire month
- When a user's monthly submission is approved → that user's month is ready to be locked
- When **all users'** monthly submissions are approved → the month can be locked
- **Approve per month** (one action) — admin can still reject individual entries within it
- Final payroll export auto-locks the month (see Epic 5)
- Admin can **reopen a locked month** — must provide reason, audit logged

### Admin Rejection Business Rules (CRITICAL)

- Admin can reject **specific individual entries** (not only entire weeks)
- Admin **MUST provide a rejection reason** for each rejected item (mandatory field)
- Rejected entries return to `Draft` status
- User sees the rejection reason **displayed clearly on the entry**
- User edits the entry and **resubmits the month**
- All rejections, corrections, and resubmissions are audit logged

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/monthly-submissions/:id/approve` | Admin | Approve a month |
| POST | `/monthly-submissions/:id/reject` | Admin | Reject a month (with reason) |
| POST | `/time-entries/:id/approve` | Admin | Approve a single entry |
| POST | `/time-entries/:id/reject` | Admin | Reject a single entry (with reason) |

#### Reject Request

```json
// POST /time-entries/:id/reject
{
  "reason": "Hours don't match the project log for this day"
}
// Returns: { status: "rejected", reason: "...", rejectedAt: "..." }
```

### Admin Edit of Employee Reports (CRITICAL)

Admin can view and edit **any employee's report**. Every admin edit must:

1. Create an audit log record with old and new values
2. Show a **visual indicator on the entry** visible to the affected user (e.g., "Modified by Admin" badge)
3. User can see the before/after values by clicking the indicator

### Admin Dashboard (MAJOR)

Admin must see a dashboard with:
- A table showing, for each user: monthly submission status for the selected month
- Status colors: not started (grey) | in progress (blue) | submitted (yellow) | approved (green) | rejected (red) | missing (orange)
- Pending reviews count (submitted but not yet reviewed)
- Quick action: click a row → go to that user's monthly review screen

### Admin Review Screen

For each submitted month, admin sees:
- User name, month, submission timestamp
- List of all entries with details (date, client, project, task, hours, description)
- Total hours for the month
- Approve Month / Reject Entry buttons

### Rejection Notice (User Side)

When an entry is rejected:
1. User receives in-app notification (see Epic 5)
2. On the daily/monthly view: rejected entry is **highlighted** (e.g., red border)
3. Rejection reason is visible directly on the entry
4. Edit button is re-enabled for that entry
5. After editing, user must **resubmit the whole month**

---

## F10 — Timer

### Business Rules (MAJOR)

- Only **ONE timer** may run at a time per user
- Timer state is **persisted server-side** — survives page refresh, browser close, device switch
- **Auto-stop** after 12 hours of continuous running (forgot-to-stop protection)
- **Reminder notification** (in-app) after 10 hours of continuous running
- If a timer is running, **monthly submission is BLOCKED**
- On stop: dialog opens for client/project/task/location/description entry
- On dialog submit: a time entry is created with the timer's start time and stop time

### DB Table

```sql
active_timers
  id UUID PK
  user_id UUID FK → users UNIQUE    -- only one timer per user at a time
  start_time TIMESTAMPTZ NOT NULL
  created_at TIMESTAMPTZ
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/timer` | User | Get current timer state (running or null) |
| POST | `/timer/start` | User | Start timer (fails if one already running) |
| POST | `/timer/stop` | User | Stop timer, returns duration, opens completion dialog |

#### Start Response

```json
// POST /timer/start
// 200 OK
{ "startTime": "2026-05-06T09:00:00Z", "elapsedMinutes": 0 }

// 409 Conflict if timer already running
{ "error": "A timer is already running since 09:00" }
```

#### Stop Response

```json
// POST /timer/stop
{
  "startTime": "2026-05-06T09:00:00Z",
  "stopTime": "2026-05-06T12:30:00Z",
  "durationMinutes": 210
}
// After this, frontend opens the completion dialog for entry details
```

### Timer UI

- **Start/Stop button** visible on the daily report screen
- **Running state**: shows elapsed time (live counter), stop button, reminder at 10h
- **Completion dialog** (on stop):
  - Client, Project, Task, Location, Description fields (all required)
  - Pre-filled date = today, start/end times from timer
  - Submit → creates time entry

---

## Test Plan

| Category | What to test | Priority |
|----------|-------------|---------|
| Unit | Submission block conditions (incomplete days in month, running timer) | CRITICAL |
| Unit | State machine — valid and invalid transitions | CRITICAL |
| Integration | POST /monthly-submissions/:id/submit — success, blocked by incomplete day | CRITICAL |
| Integration | POST /monthly-submissions/:id/submit — blocked by running timer | CRITICAL |
| Integration | POST /monthly-submissions/:id/approve — status changes to approved | CRITICAL |
| Integration | POST /time-entries/:id/reject — reason required, monthly submission moves to rejected | CRITICAL |
| Integration | Rejected entry → user can edit and resubmit month | CRITICAL |
| Integration | POST /timer/start — fails if timer already running | MAJOR |
| Integration | Timer auto-stop after 12 hours | MAJOR |
| Integration | POST /timer/stop — creates time entry with correct start/end | MAJOR |
| Permission | Only admin can approve/reject | CRITICAL |
| Permission | User cannot see other users' submission status | CRITICAL |
| Audit | Approval, rejection, resubmission all logged | MAJOR |
| Audit | Admin edit of user entry logged + visible to user | CRITICAL |
| Lifecycle | Last working day of month 23:59 auto-flags unsubmitted months as Missing | MAJOR |
