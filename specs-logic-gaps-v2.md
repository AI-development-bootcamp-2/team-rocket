# Spec Logic Gaps — Full Audit v2

**Status**: ✅ All 53 gaps fixed — spec files updated, ready for implementation  
**Rounds**: 4 full passes across all 19 F-spec files + F02 schema cross-reference  
**Total gaps found**: 53 (11 Critical 🔴, 17 High 🟠, 25 Medium 🟡)  
**Fixed**: All 53 gaps applied directly to F-spec files (F01–F19) + figma-design-spec.md  
**Date**: Post-commit to team-rocket GitHub repo  

---

## How to read this file

Each gap has:
- **Severity**: 🔴 CRITICAL (data loss / security / wrong behavior) | 🟠 HIGH (incomplete feature / wrong output) | 🟡 MEDIUM (ambiguous / missing decision)
- **Affected spec(s)**: which F-spec(s) to update
- **Issue**: exact problem statement
- **Fix**: what needs to change

---

## 🔴 CRITICAL GAPS (10)

---

### GAP-01 · F03 — Refresh token in localStorage is an OWASP XSS vulnerability

**Affected**: `specs/F03-authentication.md`

**Issue**:  
F03 line 53 reads: `"refresh in httpOnly cookie or localStorage based on Remember Me"`.  
Storing a long-lived refresh token in `localStorage` makes it readable by any JavaScript running on the page — a classic XSS attack vector (OWASP A03).

**Fix**:  
- Refresh token → **always** `httpOnly; Secure; SameSite=Lax` cookie, regardless of "Remember Me"  
- "Remember Me" only changes the cookie `maxAge`:  
  - Checked: `maxAge: 30 days`  
  - Unchecked: session cookie (no `maxAge` → deleted when browser closes)  
- Access token → **always** in memory (React state / Zustand), never persisted  
- Remove the `localStorage` option entirely

---

### GAP-02 · F02 — Five status/enum columns defined with no values

**Affected**: `specs/F02-database-schema-migrations.md`

**Issue**:  
Migration 006 creates `time_entries.status enum` and `time_entries.location enum` with no defined values.  
Migration 007 creates `absence_entries.status enum` with no values.  
Migration 009 creates `weekly_submissions.status enum` with no values.  
Migration 011 creates `audit_logs.action enum` with no values.  
Developers writing `INSERT` or `CHECK` constraints have no canonical source.

**Fix** — define these enum values inline in the migration task descriptions:

| Table | Column | Values |
|---|---|---|
| `time_entries` | `status` | `draft`, `submitted`, `approved`, `rejected` |
| `time_entries` | `location` | `office`, `home`, `client` |
| `absence_entries` | `status` | `draft`, `submitted`, `approved` |
| `weekly_submissions` | `status` | `draft`, `submitted`, `approved`, `rejected`, `missing` |
| `audit_logs` | `action` | `LOGIN`, `CREATE`, `UPDATE`, `DELETE`, `SUBMIT`, `APPROVE`, `REJECT`, `LOCK`, `UNLOCK`, `ADMIN_EDIT`, `TIMER_AUTO_STOPPED`, `WEEK_RESUBMITTED`, `EXPORT`, `PASSWORD_RESET`, `DEACTIVATE`, `ENTRY_CORRECTED` |

---

### GAP-03 · F02/F04 — `users` table missing 5 profile columns visible in Figma UserForm

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F04-user-management-admin-.md`

**Issue**:  
F04 UserForm shows these editable fields: שם פרטי | שם משפחה | מס׳ עובד | סוג משרה | אחוז משרה | שיוך ארגוני | תקן שעות יומי  
F02 migration 001 `users` table only defines: `id, email, password_hash, full_name, role, is_active, created_at, updated_at`  
Five columns have no database home.

**Fix** — add to migration 001 (or a new migration 018):

```sql
employee_number      VARCHAR(20)  UNIQUE NULL
employment_type      ENUM('full_time','part_time','contractor') NULL
employment_percentage SMALLINT   DEFAULT 100  CHECK (employment_percentage BETWEEN 0 AND 100)
department           VARCHAR(100) NULL
daily_hours_override SMALLINT    NULL  -- per-user override; NULL = use system DAILY_STANDARD_HOURS
```

Also update F04 `POST /users` and `PUT /users/:id` task descriptions to include these fields.

---

### GAP-04 · F02/F14 — `time_entries` missing `rejection_reason` column + status contradiction

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F14-admin-report-review-approval.md`

**Issue (two parts)**:

**Part A — missing column**: F14 defines `POST /time-entries/:id/reject` with a mandatory reason. F02 migration 006 has no `rejection_reason TEXT NULL` column on `time_entries`. The per-entry rejection reason has no database home (the `rejection_reason` in migration 009 belongs to `weekly_submissions`, not entries).

**Part B — status contradiction inside F14**: F14 line 21 says `"Entry status=rejected"`, but F14 line 24 says `"On reject: entry status → draft, user can edit and resubmit"`. These contradict each other. Additionally, F09's `PUT /time-entries/:id` guard says `"only if status=draft"` — so if F14 line 21's `status=rejected` is correct, the user can never edit it (blocked by F09 guard).

**Fix**:  
- Add `rejection_reason TEXT NULL` to `time_entries` in F02 migration 006  
- Clarify the lifecycle in F14: admin reject should set `status='rejected'` AND store `rejection_reason`  
- Update F09's `PUT` guard to allow editing when `status IN ('draft','rejected')` so users can correct rejected entries  
- On user edit of a rejected entry: status auto-transitions from `rejected` → `draft`

---

### GAP-05 · F02/F14 — `time_entries` missing `approved_by` and `approved_at`

**Affected**: `specs/F02-database-schema-migrations.md`

**Issue**:  
F14 approves entries (sets `status='approved'`). F02 migration 006 has no `approved_by INT FK NULL REFERENCES users(id)` or `approved_at TIMESTAMPTZ NULL` columns. The approver identity and approval timestamp are lost — this blocks audit and export requirements.

**Fix** — add to migration 006:

```sql
approved_by  INT         NULL REFERENCES users(id)
approved_at  TIMESTAMPTZ NULL
```

---

### GAP-06 · F02/F06 — `projects` table missing 3 columns visible in Figma ProjectForm

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F06-project-management-admin-.md`

**Issue**:  
F06 CreateProjectModal (section 5.6 in figma-design-spec.md) shows fields: שם הפרויקט | שם הלקוח | **שיוך מנהל ראשי** | **תאריך התחלה** | **תאריך סיום** | תאור הפרויקט  
F02 migration 003 only has: `(id, client_id FK, name, is_active, created_at, updated_at)`  
Three fields have no database home and no API task covering them.

**Fix** — add to migration 003:

```sql
manager_user_id  INT   NULL REFERENCES users(id)
start_date       DATE  NULL
end_date         DATE  NULL
description      TEXT  NULL
```

Also update F06 `POST /projects` and `PUT /projects/:id` task descriptions to include these fields.

---

### GAP-07 · F02/F07 — `tasks` table missing date columns visible in Figma TaskForm

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F07-task-management-admin-.md`

**Issue**:  
F07 CreateTaskModal shows fields: שם המשימה | שיוך לפרויקט | **תאריך התחלה** | **תאריך סיום** | תאור המשימה  
F02 migration 004 only has: `(id, project_id FK, name, status enum open/closed, created_at, updated_at)`  
Date range fields and description have no database home.

**Fix** — add to migration 004:

```sql
start_date   DATE NULL
end_date     DATE NULL
description  TEXT NULL
```

Also update F07 `POST /tasks` and `PUT /tasks/:id` task descriptions to include these fields.

---

### GAP-08 · F13 — Sunday cron silently skips users who never created an entry

**Affected**: `specs/F13-weekly-submission.md`

**Issue**:  
F13 states `"weekly_submission record created lazily on first time_entry save"`.  
The Sunday cron that flags missing submissions queries the `weekly_submissions` table. But if a user never opened the app and never saved any entry for a given week, **no `weekly_submission` record exists for that week**. The cron query returns no row for that user → the user is never flagged as `missing` → the admin dashboard (F16) silently shows them as `not_started` forever.

**Fix**:  
The Sunday cron must:  
1. Query `SELECT id FROM users WHERE is_active = true` (all active users)  
2. For each user, check if a `weekly_submission` row exists with `week_start_date = :week AND status = 'submitted'`  
3. If no submitted record → `INSERT ... status='missing'` (or `UPDATE` existing draft record to `missing`)  
Do NOT iterate only existing `weekly_submissions` records.

---

### GAP-09 · F11 — `GET /reports/monthly-summary` missing from F11 API Endpoints table

**Affected**: `specs/F11-monthly-view-report-history.md`

**Issue**:  
The endpoint `GET /reports/monthly-summary?user_id=&year=&month=` is defined in F11 task line 21 and in acceptance criteria, but it does **not appear** in F11's API Endpoints summary table at the bottom of the spec. Developers using the API table as a quick reference will miss it.

**Fix**:  
Add a row to F11's API Endpoints table:

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /reports/monthly-summary | User/Admin | KPI summary: hours, absences, week statuses, projects |

---

### GAP-10 · F15/F19 — `LOCKED_MONTH` notification assigned to F15 but F15 has no triggering task

**Affected**: `specs/F15-month-lock-unlock.md`, `specs/F19-notifications-holiday-settings.md`

**Issue**:  
F19 notification type table (line 31) reads: `LOCKED_MONTH — "Created in F15 on lock"`.  
F15 has **zero tasks** calling `notificationsService.create(...)`. The notification will never be sent.

**Fix**:  
Add to F15 `POST /admin/months/:monthId/lock` task:

```js
// After setting month status='locked':
await notificationsService.create({
  type: 'LOCKED_MONTH',
  userId: null,          // null = broadcast to all active users
  monthYear: `${year}-${month}`,
});
```

Or define the exact recipient scope (all active users vs only users with entries in that month).

---

## 🟠 HIGH GAPS (15 total: 12 below + 3 in Rounds 3–4)

---

### GAP-11 · F14 — Bulk week-approve with pre-existing `rejected` entries is undefined

**Affected**: `specs/F14-admin-report-review-approval.md`

**Issue**:  
`POST /weekly-submissions/:id/approve` is described as "approve entire week, update all entries status=approved". But if the admin previously rejected some entries (those entries are `status='rejected'`), and the user corrected and resubmitted the week — does the bulk approval also flip those entries from `rejected` → `approved`? Or does it only flip `submitted` → `approved`? Undefined behavior.

**Fix**:  
Specify in F14 that bulk approval sets `status='approved'` for **all entries** where `status IN ('submitted', 'rejected', 'draft')` belonging to that weekly_submission. (The typical flow is user resubmits → all corrected entries are `draft` → then `submitted` again, so bulk approve should cover `submitted` at minimum, but the edge case should be documented.)

---

### GAP-12 · F13 — Sunday cron timezone is unspecified

**Affected**: `specs/F13-weekly-submission.md`, `specs/F01-project-setup-infrastructure.md`

**Issue**:  
F13 says `"Sunday 23:59 Israel time"`. F01's cron setup uses node-cron but specifies no timezone. Servers running on UTC fire the cron 2–3 hours early/late depending on daylight saving (Israel is UTC+2 in winter, UTC+3 in summer). This would incorrectly flag users who submit just before the real deadline.

**Fix**:  
In F01 cron task, specify:

```js
cron.schedule('59 23 * * 0', checkMissingSubmissions, { timezone: 'Asia/Jerusalem' });
```

And add `TZ=Asia/Jerusalem` to the `.env.example` and Docker environment variables.

---

### GAP-13 · F12 — Document validation for sick/reserve is contradictory

**Affected**: `specs/F12-absence-reporting.md`

**Issue**:  
Backend task in F12 states: `"Validate: sick requires document"` — implies a hard block at `POST /absences`.  
Frontend UI state in F12 states: `"sick/reserve without document shows inline warning (not a hard block until submit)"`.  
These are inconsistent: is saving without a document allowed or not?

**Fix**:  
Define a single rule:  
- `POST/PUT /absences` without document: **accept** the save, return `200` with `{ data, warning: 'חובה לצרף מסמך עד להגשה' }`  
- `POST /weekly-submissions/:weekId/submit` validation: **hard block** if any absence entry of type `sick` or `reserve` has no document  
(Same pattern as F05/F06 warn-but-allow for duplicates, hard-block at submission gate.)

---

### GAP-14 · F16 — `missing` status race condition between cron and live dashboard

**Affected**: `specs/F16-admin-dashboard.md`

**Issue**:  
`GET /admin/dashboard` reads `weekly_submissions.status` from the database. The `missing` status is only written by the Sunday 23:59 cron. Between Monday 00:00 and the next Sunday, weeks that were never submitted appear as `not_started` in the dashboard even though their deadline has passed.

**Fix**:  
In the dashboard query service, compute `missing` **live** using:

```sql
CASE
  WHEN ws.status IN ('draft','not_started') AND ws.week_start_date + INTERVAL '7 days' < NOW() AT TIME ZONE 'Asia/Jerusalem'
  THEN 'missing'
  ELSE ws.status
END
```

Or: handle via a virtual field in the response DTO rather than the persisted DB value.

---

### GAP-15 · F18 — `ENTRY_CORRECTED` audit action used in export query but never defined

**Affected**: `specs/F18-export-excel-pdf-.md`, `specs/F02-database-schema-migrations.md`, `specs/F17-audit-log.md`

**Issue**:  
F18 export query JOINs audit_logs with `WHERE action IN ('ADMIN_EDIT','ENTRY_CORRECTED')` to show correction history in the Excel export. But `ENTRY_CORRECTED` appears nowhere else in any spec — not in F02's action enum, not in F17's action badge color map.

**Fix**:  
Add `ENTRY_CORRECTED` to:  
- F02 `audit_logs.action` enum values (see GAP-02)  
- F17 action badge color map  
- Define when it's emitted: when a **user** edits a previously-rejected entry (distinguishes from `ADMIN_EDIT` which is when an admin edits a user's entry)

---

### GAP-16 · F17 — Audit log UI action badge colors missing for 10+ action types

**Affected**: `specs/F17-audit-log.md`

**Issue**:  
F17's badge color table only defines: `CREATE / UPDATE / DELETE / LOGIN / ADMIN_EDIT`.  
At least 11 other action types have no defined badge color, so the UI will have unhandled states:  
`SUBMIT, APPROVE, REJECT, LOCK, UNLOCK, EXPORT, PASSWORD_RESET, DEACTIVATE, TIMER_AUTO_STOPPED, WEEK_RESUBMITTED, ENTRY_CORRECTED`

**Fix** — add badge color rows:

| Action | Background | Text | Notes |
|---|---|---|---|
| SUBMIT | `#DBEAFE` | `#2563EB` | Blue (same as submitted status) |
| APPROVE | `#DCFCE7` | `#16A34A` | Green |
| REJECT | `#FEE2E2` | `#EF4444` | Red |
| LOCK | `#F3F4F6` | `#374151` | Gray |
| UNLOCK | `#FEF3C7` | `#D97706` | Amber |
| EXPORT | `#F3F4F6` | `#374151` | Gray |
| PASSWORD_RESET | `#FEF3C7` | `#D97706` | Amber |
| DEACTIVATE | `#FEE2E2` | `#EF4444` | Red |
| TIMER_AUTO_STOPPED | `#F3F4F6` | `#374151` | Gray |
| WEEK_RESUBMITTED | `#DBEAFE` | `#2563EB` | Blue |
| ENTRY_CORRECTED | `#EDE9FE` | `#7C3AED` | Purple |

---

### GAP-17 · F18 — Synchronous export GET will timeout for large datasets

**Affected**: `specs/F18-export-excel-pdf-.md`

**Issue**:  
`GET /exports` is specified as a synchronous endpoint that generates and streams an Excel/PDF file. For large organisations with many users across a full month, file generation can exceed HTTP timeout thresholds. F18 notes "can take seconds for large exports" but does not address the timeout problem.

**Fix**:  
Either:  
- **Option A (preferred)**: Make the endpoint stream with `res.setHeader('Content-Type', 'application/vnd.openxmlformats...')` + `res.setHeader('Transfer-Encoding','chunked')` and stream directly — acceptable for moderate datasets  
- **Option B (enterprise scale)**: `POST /exports/jobs` → returns `{ jobId }` → `GET /exports/jobs/:jobId/status` → `GET /exports/jobs/:jobId/download`  

Add a decision to F18 on which option to implement. A server-side timeout of 30 seconds with appropriate error handling is minimum requirement.

---

### GAP-18 · F19 — "Mark all as read" shown in UI but no API endpoint exists

**Affected**: `specs/F19-notifications-holiday-settings.md`

**Issue**:  
F19 NotificationList header UI spec (line 113) shows `"סמן הכל כנקרא"` (mark all as read) as a blue link.  
F19 only defines `PUT /notifications/:id/read` (single notification). There is no bulk endpoint.

**Fix**:  
Add to F19 API tasks:

```
PUT /notifications/read-all — mark all unread notifications as read for the authenticated user
```

And add to the API endpoints table in F19.

---

### GAP-19 · F03 — 30-minute inactivity timeout has no implementation spec

**Affected**: `specs/F03-authentication.md`

**Issue**:  
F03 mentions `"Implement inactivity timeout (30 min): auto-logout with warning dialog"` but specifies nothing about implementation approach:  
- Which events reset the timer? (mousemove, keydown, scroll, click, touchstart?)  
- Does the timer track last API call or last DOM event?  
- Warning dialog: at T-2 minutes? T-5 minutes?  
- What happens if user is actively filling a form when timeout fires? (unsaved work loss)  

Without this spec, two developers will implement it completely differently.

**Fix**:  
Add to F03 an implementation task:

```
- Track last activity via 'mousemove','keydown','click','touchstart' events on window
- Debounce reset: only reset timer if >10s since last reset (avoid thrashing)
- At T-2 min remaining: show modal "אתה עומד להתנתק בעוד 2 דקות. האם להמשיך?"
  - "כן, המשך" button → reset timer
  - Auto-dismiss after 2 min → POST /auth/logout → redirect to login
- On any authenticated API call: also reset the inactivity timer
- Edge case: if a form is dirty when auto-logout fires, emit a 'beforeAutoLogout' event
  so UI components can save a draft (F09 autosave) before the session ends
```

---

### GAP-20 · F02/F05 — `clients` table missing `client_number` column visible in Figma table

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F05-client-management-admin-.md`

**Issue**:  
F05's client management table (from figma-design-spec.md §5.5) shows a `"מס׳ לקוח"` (client number) column in the admin table view. F02 migration 002 only has `(id, name, contact_info, is_active, created_at, updated_at)` — no client_number column. The `id` (auto-increment PK) is not suitable as a human-readable "client number".

**Fix** — add to migration 002:

```sql
client_number  VARCHAR(20)  UNIQUE NULL  -- optional display identifier, admin-assigned
```

Or document explicitly: "client_number = the internal id displayed with zero-padding (e.g., `#001`)". Either way needs a decision in F05 and F02.

---

### GAP-21 · F08 — Archived project stays in `permission_flags.scoped_project_ids`

**Affected**: `specs/F08-user-task-assignments.md`, `specs/F06-project-management-admin-.md`

**Issue**:  
F06 `DELETE /projects/:id` soft-deletes (sets `is_active=false`). Users who had `canAssignProjectTasks` permission with `scoped_project_ids = [archivedProjectId, ...]` in `permission_flags` still have the archived project in their scope. No spec defines cleanup.  
Immediate effect: the permission check in F08 filtering logic will include a stale project_id; the UI may show "no tasks" but the permission record is corrupted.

**Fix**:  
Add to F06 `DELETE /projects/:id` task:

```sql
UPDATE permission_flags
SET scoped_project_ids = array_remove(scoped_project_ids, :projectId)
WHERE :projectId = ANY(scoped_project_ids);
```

---

---

## 🟡 MEDIUM GAPS (16 total: 13 below + 3 in Rounds 3–4)

---

### GAP-22 · F12 — `absence_entries.status` lifecycle is completely undefined

**Affected**: `specs/F12-absence-reporting.md`, `specs/F02-database-schema-migrations.md`

**Issue**:  
`time_entries` has a well-defined lifecycle: `draft → submitted → approved / rejected`.  
`absence_entries` has a `status enum` column (migration 007) but:  
- Enum values are never defined anywhere (see GAP-02)  
- No approval workflow for absences is specified  
- Does the admin approve absences independently? Or are they auto-approved when the weekly submission is approved?

**Fix**:  
Choose one model and document it in F12:  
- **Option A (simple)**: Absences follow the weekly submission lifecycle — no independent approval. When the week is approved, all its absences are implicitly approved. `status` only has `draft` and `submitted` (no `approved` needed separately).  
- **Option B (independent)**: Admin can approve/reject individual absence entries. Requires new endpoints in F14.

---

### GAP-23 · F15 — Lock precondition is ambiguous (hard block vs confirmation dialog)

**Affected**: `specs/F15-month-lock-unlock.md`

**Issue**:  
F15 UI shows a disabled lock button with tooltip "X weeks not yet approved". The acceptance criteria only say "lock blocks all editing". It is undefined whether:  
- The admin is **hard-blocked** from locking if unapproved weeks exist (button stays disabled)  
- OR the admin sees a **confirmation dialog** ("X weeks remain unapproved. Lock anyway?") and CAN proceed

The difference affects the backend: does `POST /admin/months/:monthId/lock` return 422 if unapproved weeks exist, or always proceed?

**Fix**:  
Choose and document: recommend confirmation dialog with list of unapproved weeks, not a hard block (admin may intentionally lock with partial approvals at month-end).

---

### GAP-24 · F09/F12 — Partial-day absence validation ownership is undefined

**Affected**: `specs/F09-daily-time-reporting.md`, `specs/F12-absence-reporting.md`

**Issue**:  
F12 says "partial absence: validate remaining hours are covered by work entries". But:  
- F09's `PUT /time-entries/:id` does not mention this cross-check  
- F12's `POST /absences` does not specify it either  
- No spec defines which service owns this validation, which endpoint triggers it, and what the error response looks like  

**Fix**:  
Document in F13 (weekly submission validation gate) as the canonical check point:  
"At submit time: for each day with a partial absence, verify `sum(time_entry.duration_minutes) + absence_hours >= DAILY_STANDARD_HOURS`. Return 422 `{ error: 'PARTIAL_ABSENCE_UNCOVERED', date, missing_hours }` if not."

---

### GAP-25 · F04/F02 — `full_name` vs split first + last name

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F04-user-management-admin-.md`

**Issue**:  
Figma UserForm shows two separate fields side by side: `שם פרטי` (first name) and `שם משפחה` (last name).  
F02 migration 001 has a single `full_name VARCHAR` column.  
F04 API tasks also use `full_name` for `POST /users` body.  
The form collects two values but the DB stores one — the mapping is undocumented.

**Fix**:  
Choose one and document:  
- **Option A (recommended for search/sort)**: Split into `first_name VARCHAR(100)` + `last_name VARCHAR(100)`, add computed/virtual `full_name` for display  
- **Option B (simple)**: Keep single `full_name`, document that UI concatenates first+last before submitting: `full_name = "${first} ${last}"`  

Also update F04 `POST /users` request body spec to match the chosen option.

---

### GAP-26 · F01 — `.env.example` content is never specified

**Affected**: `specs/F01-project-setup-infrastructure.md`

**Issue**:  
F01 task list includes `"Add .gitignore, .env.example, README skeleton"` but no spec anywhere defines what environment variables are required. A developer cloning the repo cannot configure the project without this reference.

**Fix**:  
Add to F01 an `.env.example` content task listing all required variables:

```env
# Server
NODE_ENV=development
PORT=3001
TZ=Asia/Jerusalem

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/finale_db

# JWT
JWT_ACCESS_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS
FRONTEND_URL=http://localhost:5173

# File storage
STORAGE_DRIVER=local            # 'local' or 's3'
AWS_BUCKET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Email (for password reset notifications)
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@company.com

# App settings (seed defaults)
DAILY_STANDARD_HOURS=9
MONTHLY_QUOTA_HOURS=186
```

---

### GAP-27 · F02/F04 — `users.role` enum values are never defined

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F04-user-management-admin-.md`

**Issue**:  
F02 migration 001 creates `users.role enum` but never defines its values. F04 mentions "change role" as an admin action. F06 ProjectForm has a "שיוך מנהל ראשי" (lead manager) dropdown implying a manager-level role may exist.

**Fix**:  
Add to F02 migration 001 role enum definition:

```sql
role ENUM('admin', 'user') NOT NULL DEFAULT 'user'
```

And document: "Lead manager assignment in F06 is a project-level relationship (`projects.manager_user_id`), NOT a separate role. All humans are either `admin` or `user`. There is no `manager` role."

---

### GAP-28 · F12 — `GET /absences` admin access scope undefined

**Affected**: `specs/F12-absence-reporting.md`

**Issue**:  
F12 API table shows `GET /absences — User/Admin` but does not define what admin sees. Does admin get all users' absences? Does admin require a `user_id` query param? The F09 equivalent (`GET /time-entries`) explicitly says "User: own only. Admin: any user." F12 has no such clarification.

**Fix**:  
Add to F12 `GET /absences` task:  
`"User: own only (filtered by token.userId). Admin: all users, optionally filtered by user_id, date_from, date_to query params."`

---

### GAP-29 · F11 — `ReportHistoryPage` has no defined URL route

**Affected**: `specs/F11-monthly-view-report-history.md`, `specs/figma-design-spec.md`

**Issue**:  
F11 says `"ReportHistoryPage.jsx — separate screen (per original spec navigation)"`. figma-design-spec.md §7.1 Webapp Flow only defines `/` (Home = Monthly Report). There is no `/reports/history` or equivalent route defined anywhere.

**Fix**:  
Add to figma-design-spec.md §7.1:

```
/reports/history   ← F11 (ReportHistoryPage — past months read-only view)
```

And add to F11 spec: `"Route: /reports/history"` and `"Navigation: accessible from main monthly view via 'היסטוריית דיווחים' link"`.

---

### GAP-30 · F09 — "No assignments" empty state missing from F09 UI states

**Affected**: `specs/F09-daily-time-reporting.md`

**Issue**:  
When a new user has zero task assignments (F08), `GET /time-entries/dropdown-data` returns empty arrays for clients/projects/tasks. F09's UI states section does not include this case. The user sees empty project dropdowns with no explanation and no call-to-action, creating a confusing dead-end.

**Fix**:  
Add to F09 UI states:  
`"No assignments state: if dropdown-data returns empty clients array, show full-width info banner: 'לא שויכת עדיין למשימות. פנה למנהל המערכת לקבלת גישה.' Disable 'הוספת פרויקט' button."`

---

### GAP-31 · F04 — Self-deactivation uses HTTP 400 but should be 403

**Affected**: `specs/F04-user-management-admin-.md`

**Issue**:  
F04 specifies `"DELETE /users/:id — returns 400 if admin attempts to deactivate themselves"`. HTTP `400 Bad Request` means the request is malformed. Self-deactivation is a valid, well-formed request that is **forbidden** by business logic — the correct status is `403 Forbidden` (or `422 Unprocessable Entity`).

**Fix**:  
Change the spec to return `403 Forbidden` with body `{ error: 'SELF_DEACTIVATION_FORBIDDEN', message: 'אינך יכול לבטל את הפעלת החשבון שלך' }`.

---

### GAP-32 · F02/F14 — `weekly_submissions.reviewed_by` name is ambiguous

**Affected**: `specs/F02-database-schema-migrations.md`

**Issue**:  
F02 migration 009 has `reviewed_by FK` and `reviewed_at` which cover the admin who took action (approve or reject). The column name "reviewed_by" is ambiguous — does reviewing mean approving? Or just looking at? This causes confusion when querying "who approved this week?"

**Fix**:  
Either:  
- Rename to `actioned_by` / `actioned_at` (covers both approve and reject)  
- OR split into `approved_by` / `approved_at` + `rejected_by` / `rejected_at`  

Document the choice explicitly. If keeping `reviewed_by`, add a comment in the migration: `-- populated on both APPROVE and REJECT actions; check status column to determine which`.

---

### GAP-33 · F06 — Duplicate project name warning: response format unspecified

**Affected**: `specs/F06-project-management-admin-.md`

**Issue**:  
F06 mentions "Warn on duplicate name under same client". F05's equivalent explicitly defines the API response format:  
`{ data: {...}, warning: 'A client with this name already exists' }`  
F06 specifies no such response format. Developers will implement it inconsistently.

**Fix**:  
Add to F06 `POST /projects` task:  
`"If name already exists under same client_id (case-insensitive): return 201 with { data: {...}, warning: 'פרויקט בשם זה כבר קיים תחת לקוח זה' } — warn but allow."`

---

### GAP-34 · F19 — `PUT /settings` has no response format or partial-failure spec

**Affected**: `specs/F19-notifications-holiday-settings.md`

**Issue**:  
F19 defines `PUT /settings` to update system settings key-value pairs. No spec defines:  
- Response body format on success  
- What happens if one key fails validation (partial update — are other keys rolled back?)  
- Whether the update is atomic (single transaction or per-key)  
- `DAILY_STANDARD_HOURS` change affects retroactive quota calculations for existing months — no spec addresses this side-effect

**Fix**:  
Add to F19 `PUT /settings` task:  
- Response: `{ settings: { key: value, ... } }` (full settings object after update)  
- Updates must be atomic (wrap in single DB transaction; fail all or none)  
- `DAILY_STANDARD_HOURS` change: apply to new entries only (not retroactive). Document: "Changing DAILY_STANDARD_HOURS does not recalculate existing weekly_submissions quotas."

---

### GAP-35 · Cross-spec — User-facing `GET /clients`, `GET /projects`, `GET /tasks` scoping rules inconsistent

**Affected**: `specs/F05-client-management-admin-.md`, `specs/F06-project-management-admin-.md`, `specs/F07-task-management-admin-.md`, `specs/F09-daily-time-reporting.md`

**Issue**:  
The three entity list endpoints have inconsistent scoping definitions:  
- F05: `GET /clients — User: only clients with assigned tasks`  
- F06: `GET /projects — User: only projects with assigned tasks`  
- F07: `GET /tasks — User: filter by project_id, status` (no user scoping mentioned)  
F09 uses `GET /time-entries/dropdown-data` as the source for its dropdowns — which presumably applies the correct user scope. But the individual entity endpoints (used for breadcrumbs, detail views, admin lookups) need consistent rules.

**Fix**:  
Add to F07 `GET /tasks`:  
`"User: only tasks assigned to this user (via user_task_assignments). Admin: all tasks, optionally filtered by project_id, status."`  
And ensure the scoping logic (`JOIN user_task_assignments WHERE user_id = :tokenUserId`) is consistently implemented across F05, F06, and F07 middleware.

---

## Summary Table

| # | Severity | Primary Spec | Short Description |
|---|---|---|---|
| GAP-01 | 🔴 | F03 | Refresh token in localStorage = XSS risk |
| GAP-02 | 🔴 | F02 | 5 enum columns with no defined values |
| GAP-03 | 🔴 | F02/F04 | users table missing 5 Figma profile columns |
| GAP-04 | 🔴 | F02/F14 | time_entries missing rejection_reason + status contradiction |
| GAP-05 | 🔴 | F02/F14 | time_entries missing approved_by / approved_at |
| GAP-06 | 🔴 | F02/F06 | projects table missing manager_id, start_date, end_date |
| GAP-07 | 🔴 | F02/F07 | tasks table missing start_date, end_date |
| GAP-08 | 🔴 | F13 | Sunday cron skips users with no weekly_submission record |
| GAP-09 | 🔴 | F11 | GET /reports/monthly-summary absent from API table |
| GAP-10 | 🔴 | F15/F19 | LOCKED_MONTH notification has no triggering task in F15 |
| GAP-11 | 🟠 | F14 | Bulk approve with pre-existing rejected entries: undefined |
| GAP-12 | 🟠 | F13/F01 | Sunday cron timezone not specified (needs Asia/Jerusalem) |
| GAP-13 | 🟠 | F12 | Document validation: hard block vs warn-not-block contradiction |
| GAP-14 | 🟠 | F16 | `missing` status race condition: DB vs live computation |
| GAP-15 | 🟠 | F18/F17 | ENTRY_CORRECTED action used but never defined |
| GAP-16 | 🟠 | F17 | Audit log badge colors missing for 11 action types |
| GAP-17 | 🟠 | F18 | Synchronous export GET will timeout on large datasets |
| GAP-18 | 🟠 | F19 | "Mark all as read" UI button has no API endpoint |
| GAP-19 | 🟠 | F03 | 30-min inactivity timeout has no implementation spec |
| GAP-20 | 🟠 | F02/F05 | clients table missing client_number (Figma shows "מס׳ לקוח") |
| GAP-21 | 🟠 | F08/F06 | Archived project stays in permission_flags.scoped_project_ids |
| GAP-22 | 🟡 | F12/F02 | absence_entries.status lifecycle completely undefined |
| GAP-23 | 🟡 | F15 | Lock precondition: hard block vs confirmation dialog |
| GAP-24 | 🟡 | F09/F12 | Partial-day absence validation: no service ownership defined |
| GAP-25 | 🟡 | F02/F04 | full_name vs split first_name + last_name |
| GAP-26 | 🟡 | F01 | .env.example content never specified |
| GAP-27 | 🟡 | F02/F04 | users.role enum values never defined |
| GAP-28 | 🟡 | F12 | GET /absences admin access scope not defined |
| GAP-29 | 🟡 | F11 | ReportHistoryPage has no defined URL route |
| GAP-30 | 🟡 | F09 | "No assignments" empty state missing from F09 |
| GAP-31 | 🟡 | F04 | Self-deactivation returns 400 — should be 403 |
| GAP-32 | 🟡 | F02/F14 | weekly_submissions.reviewed_by column name is ambiguous |
| GAP-33 | 🟡 | F06 | Duplicate project name warning response format unspecified |
| GAP-34 | 🟡 | F19 | PUT /settings: no response format, no partial-failure spec |
| GAP-35 | 🟡 | F05/F06/F07 | User-facing entity list scoping inconsistent across 3 specs |
| GAP-36 | 🟠 | F02 | absence_entries.type + audit_logs.target_entity_type enums undefined |
| GAP-37 | 🟠 | F02/F10 | active_timers missing warning_sent_at; 10h dedup mechanism undefined |
| GAP-38 | 🟡 | F02/F19 | holiday_calendar.type enum values never defined |
| GAP-39 | 🟠 | F13/F19 | WEEKLY_SUBMISSION_DEADLINE_DAY configurable but cron hardcoded to Sunday |
| GAP-40 | 🟡 | F14/F19 | ADMIN_EDIT notification has no triggering call in F14 |
| GAP-41 | 🟡 | F19 | Thursday email cron: recipient scope + "unsubmitted" definition undefined |
| GAP-42 | 🔴 | F09/F02 | DELETE /time-entries is "soft delete" but no deleted_at column in F02 |
| GAP-43 | 🟠 | F13 | WeeklySubmitBar has no badge definition for `missing` status |
| GAP-44 | 🟠 | F13/F19 | Sunday cron has no notificationsService.create(MISSING_REPORT) call |
| GAP-45 | 🟠 | F09/F19 | QUOTA_WARNING notification has no triggering call in F09 |
| GAP-46 | 🟡 | F15 | Admin route URL missing /admin/ prefix vs all other admin routes |
| GAP-47 | 🟡 | F09 | GET /time-entries/daily-summary in API table but no backend task |
| GAP-48 | 🟡 | F03/F02 | refresh_tokens described as "Optional" in F03 but mandatory migration in F02 |
| GAP-49 | 🟡 | F02 | month_locks missing UNIQUE(year, month) constraint |
| GAP-50 | 🟡 | F14 | RejectReasonDialog predefined-reasons dropdown has no defined source |
| GAP-51 | 🟡 | F16/F02 | Dashboard API says `in_progress` but DB + UI both use `draft` |
| GAP-52 | 🟠 | F10/F02 | TIMER_LONG_RUNNING used for both 10h warning + 12h auto-stop — dedup kills auto-stop notification |
| GAP-53 | 🟡 | F09/F04 | dropdown-data doesn't specify how sort_prefs are applied to results |

---

---

## 🟠 HIGH GAPS (continued from above — found in Round 3)

---

### GAP-36 · F02 — `absence_entries.type` and `audit_logs.target_entity_type` enum values never defined

**Affected**: `specs/F02-database-schema-migrations.md`

**Issue**:  
GAP-02 catalogued 5 missing enums but missed two more:

1. Migration 007 `absence_entries.type enum` — no values defined anywhere. Required for `POST /absences` validation, quota calculation (vacation vs sick vs reserve affect quota differently), and the Figma absence-type dropdown.

2. Migration 011 `audit_logs.target_entity_type enum` — no values defined. F17 audit log UI has entity-type filters ("Filter by: User | Entry | Week | Month") but the enum backing those filters is never specified.

**Fix** — add values:

| Table | Column | Values |
|---|---|---|
| `absence_entries` | `type` | `sick`, `vacation_full`, `vacation_half`, `reserve` |
| `audit_logs` | `target_entity_type` | `USER`, `CLIENT`, `PROJECT`, `TASK`, `ASSIGNMENT`, `TIME_ENTRY`, `ABSENCE`, `WEEKLY_SUBMISSION`, `MONTH_LOCK`, `SETTING`, `HOLIDAY`, `TIMER` |

---

### GAP-37 · F02/F10 — `active_timers` missing `warning_sent_at` field; 10h deduplication mechanism undefined

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F10-timer-feature.md`

**Issue**:  
F10 and F19 both specify: "10h warning notification — deduplicated: only 1 per timer session."  
`active_timers` table has: `(id, user_id FK unique, start_time, created_at)`.  
There is no `warning_sent_at TIMESTAMPTZ NULL` or `ten_hour_warning_sent BOOLEAN DEFAULT false` column.  
The deduplication check either needs: a flag on the timer row, OR a query joining notifications to check if one already exists for this session.  
The second approach requires `notifications.related_entity_id` to store the `active_timers.id` — but when the timer is stopped and the row is deleted from `active_timers`, the reference becomes dangling.

**Fix**:  
Add to `active_timers` migration 014:

```sql
warning_sent_at  TIMESTAMPTZ  NULL  -- set when 10h notification is created; NULL = not yet sent
```

The 10h cron check: `WHERE start_time < NOW() - INTERVAL '10 hours' AND warning_sent_at IS NULL`.  
On sending: `UPDATE active_timers SET warning_sent_at = NOW() WHERE id = :id`.

---

### GAP-38 · F19 — `holiday_calendar.type` enum values never defined

**Affected**: `specs/F02-database-schema-migrations.md`, `specs/F19-notifications-holiday-settings.md`

**Issue**:  
Migration 013 `holiday_calendar.type enum` — values never defined. This affects:  
- The `POST /settings/holidays` validation (what types are valid?)  
- Quota calculation: does a `partial_day` holiday type reduce quota by 4.5h instead of 9h?  
- The Figma admin holiday form (dropdown of holiday types — options unknown)

**Fix**:  
Define enum values in F02 migration 013 and F19:

```sql
type ENUM('national', 'company', 'partial_day')
```

And document in F19: `"partial_day holidays reduce daily quota by 50% (DAILY_STANDARD_HOURS / 2). national and company holidays reduce daily quota by 100%."`

---

### GAP-39 · F13/F19 — `WEEKLY_SUBMISSION_DEADLINE_DAY` is configurable but the submission cron is hardcoded to Sunday

**Affected**: `specs/F13-weekly-submission.md`, `specs/F19-notifications-holiday-settings.md`

**Issue**:  
F19 defines a system setting `WEEKLY_SUBMISSION_DEADLINE_DAY` (default: `0` = Sunday) as admin-configurable.  
F13's cron task reads: `cron.schedule('59 23 * * 0', ...)` — **hardcoded to Sunday (day 0)**.  
If an admin changes the deadline to Saturday (`6`), the cron schedule doesn't change.  
The Thursday reminder email cron in F19 is also implicitly relative to this deadline day — if deadline moves, Thursday reminder may no longer be the right timing.

**Fix**:  
Either:  
- **Option A**: Mark `WEEKLY_SUBMISSION_DEADLINE_DAY` as **read-only / informational** (cannot be changed after initial setup) and document that changing it requires a server restart  
- **Option B (correct)**: On app startup and whenever `PUT /settings` modifies this key, reschedule the cron dynamically:

```js
function scheduleSubmissionCron(deadlineDay) {
  if (activeSubmissionJob) activeSubmissionJob.stop();
  activeSubmissionJob = cron.schedule(
    `59 23 * * ${deadlineDay}`,
    checkMissingSubmissions,
    { timezone: 'Asia/Jerusalem' }
  );
}
```

Document the chosen approach in F13 and F19.

---

## 🟡 MEDIUM GAPS (continued from above — found in Round 3)

---

### GAP-40 · F14/F19 — `ADMIN_EDIT` notification has no triggering `notificationsService.create()` call in F14

**Affected**: `specs/F14-admin-report-review-approval.md`

**Issue**:  
F19 (line 31) states: `ADMIN_EDIT — "Created in F14 admin edit path"`.  
F14's admin edit task says: `"Audit log: action=ADMIN_EDIT, actor=admin, target=entry_id, old_value, new_value."` — but contains no `notificationsService.create({ type: 'ADMIN_EDIT', ... })` call.  
The user will never receive an in-app notification when an admin silently edits their time entry.  
This is the same pattern as GAP-10 (LOCKED_MONTH trigger missing from F15).

**Fix**:  
Add to F14 admin edit task:

```js
await notificationsService.create({
  type: 'ADMIN_EDIT',
  userId: entry.user_id,
  relatedEntityType: 'TIME_ENTRY',
  relatedEntityId: entry.id,
  body: `המנהל ערך את הדיווח שלך לתאריך ${entry.date}`,
});
```

---

### GAP-41 · F19 — Thursday email cron: recipient scope and "unsubmitted" definition are both undefined

**Affected**: `specs/F19-notifications-holiday-settings.md`

**Issue**:  
F19 defines a Thursday cron to send email reminders for unsubmitted weeks. Two things are undefined:

1. **Recipients**: Which users get the email? All active users? Only users who have at least one `time_entry` (implying they are actively using the system)? Or everyone whose weekly_submission is `draft/not_started` for the current week?

2. **"Unsubmitted" definition**: Does it include users who haven't started the week at all (no `weekly_submission` record)? Or only users who started but haven't submitted (`status='draft'`)? — This intersects with GAP-08 (cron silently skipping users with no record).

Without these definitions, two developers will implement completely different recipient lists.

**Fix**:  
Add to F19 Thursday email task:  
`"Recipients: all active users WHERE no weekly_submission exists with status='submitted' for the current week (week_start_date = current week's Sunday). This includes users with no weekly_submission record at all (see F13 GAP-08). Exclude admin-only users."`

---

---

---

## 🔴 CRITICAL GAPS (continued — found in Round 4)

---

### GAP-42 · F09 — `DELETE /time-entries/:id` is called "soft delete" but `time_entries` has no `deleted_at` column

**Affected**: `specs/F09-daily-time-reporting.md`, `specs/F02-database-schema-migrations.md`

**Issue**:  
F09 line 23 reads: `"DELETE /time-entries/:id — soft delete (only if status=draft AND month not locked AND week status is draft or rejected)"`.  
F02 migration 006 `time_entries` table has no `deleted_at TIMESTAMPTZ NULL` or `is_deleted BOOLEAN` column.  
Without one of these columns, "soft delete" is architecturally impossible — a `DELETE FROM time_entries WHERE id = :id` would permanently erase the record, destroying audit trail for that entry.

**Fix**:  
Add to F02 migration 006:

```sql
deleted_at  TIMESTAMPTZ  NULL  -- soft-delete timestamp; NULL = active record
```

All queries against `time_entries` must add `WHERE deleted_at IS NULL` as a default filter. The F09 `DELETE` endpoint should execute: `UPDATE time_entries SET deleted_at = NOW() WHERE id = :id`.

---

## 🟠 HIGH GAPS (continued — found in Round 4)

---

### GAP-43 · F13 — `WeeklySubmitBar` has no UI definition for `missing` status badge

**Affected**: `specs/F13-weekly-submission.md`

**Issue**:  
F13's WeeklySubmitBar status badge table defines: `not_started (gray)`, `draft (amber)`, `submitted (blue)`, `approved (green)`, `rejected (red)` — but has **no `missing` badge definition**.  
The F13 cron sets `status='missing'` in the DB. The F16 admin dashboard shows it (with its own color system). But the user-facing WeeklySubmitBar component has no corresponding badge style.  
Users who missed the deadline will see an undefined/blank state.

**Fix**:  
Add to F13 WeeklySubmitBar status badges:

```
- Missing: background: #FDB5BC, color: #991B1B — "חסר — לא דווח במועד"
```

(Darker red than rejected to indicate severity. Also add: "Submit button hidden for missing state; show dark-red banner: 'לא ניתן להגיש — השבוע נסגר אוטומטית. פנה למנהל.'")

---

### GAP-44 · F13 — Sunday cron has no `notificationsService.create({ type: 'MISSING_REPORT' })` call

**Affected**: `specs/F13-weekly-submission.md`, `specs/F19-notifications-holiday-settings.md`

**Issue**:  
F19 notification type definition reads: `MISSING_REPORT — "week auto-flagged missing after Sunday deadline. Created by F13 cron."`.  
F13's cron task reads only: `"auto-flag unsubmitted weeks as 'missing' for all users"` — with no explicit `notificationsService.create()` call anywhere in F13.  
Same pattern as GAP-10 (F15/LOCKED_MONTH) and GAP-40 (F14/ADMIN_EDIT): responsibility is documented in F19 but the triggering task is absent from the feature spec.

**Fix**:  
Add to F13 cron task:

```js
await notificationsService.create({
  type: 'MISSING_REPORT',
  userId,
  relatedEntityType: 'WEEKLY_SUBMISSION',
  relatedEntityId: weeklySubmission.id,
  body: `שבוע ${weekStartDate} לא דווח במועד — השבוע סומן כחסר`,
});
```

---

### GAP-45 · F09 — `QUOTA_WARNING` notification has no triggering call in F09

**Affected**: `specs/F09-daily-time-reporting.md`, `specs/F19-notifications-holiday-settings.md`

**Issue**:  
F19 defines: `QUOTA_WARNING — "user has reported ≥90% of monthly quota. Created on every time_entry save; deduplicated: max 1 per user per month."`.  
F01 says: `"On every time_entry save → quota warning check (F19)"`.  
But F09's `POST /time-entries` and `PUT /time-entries` tasks have **no `notificationsService.create({ type: 'QUOTA_WARNING' })` call**.  
Without this call in F09, the quota warning notification will never fire.

**Fix**:  
Add to F09 `POST /time-entries` and `PUT /time-entries` tasks:

```js
// After saving the entry, check quota:
const monthlyTotal = await timeEntriesService.getMonthlyTotal(userId, year, month);
const quota = systemSettings.MONTHLY_QUOTA_HOURS;
if (monthlyTotal / quota >= 0.90) {
  // Deduplicated: only create if no QUOTA_WARNING for this user+month already
  const alreadyWarned = await notificationsService.existsForMonth(userId, 'QUOTA_WARNING', year, month);
  if (!alreadyWarned) {
    await notificationsService.create({ type: 'QUOTA_WARNING', userId, month, year });
  }
}
```

---

## 🟡 MEDIUM GAPS (continued — found in Round 4)

---

### GAP-46 · F15 — Admin route URL inconsistency: `/months/:year/:month/lock` vs `/admin/months/...`

**Affected**: `specs/F15-month-lock-unlock.md`

**Issue**:  
F15 defines routes as `POST /months/:year/:month/lock` and `POST /months/:year/:month/unlock`.  
F14 and F16 use the `/admin/` URL prefix for all admin-only endpoints (e.g. `GET /admin/dashboard`, `GET /approvals/pending`).  
Existing GAP-10's fix references `POST /admin/months/:monthId/lock`. This inconsistency means either:  
1. F15's URL is missing the `/admin/` prefix that all other admin routes use, OR  
2. F15 is intentionally omitting the prefix (requires separate documentation why)

**Fix**:  
Standardize F15 routes to match the `/admin/` prefix convention:

```
POST /admin/months/:year/:month/lock    → (Admin only)
POST /admin/months/:year/:month/unlock  → (Admin only)
GET  /admin/months/:year/:month/status  → (User/Admin)
GET  /admin/months                      → (Admin only)
```

Also update GAP-10's fix reference to use this consistent pattern.

---

### GAP-47 · F09 — `GET /time-entries/daily-summary` in API table but no backend task creates it

**Affected**: `specs/F09-daily-time-reporting.md`

**Issue**:  
F09's API Endpoints table includes: `GET /time-entries/daily-summary?date= — "Hours reported, remaining, status"`.  
None of F09's backend tasks (section 1, items 1–15) define the implementation for this endpoint. Every other endpoint in F09 has a corresponding task. This one is orphaned — it appears only in the API table.

**Fix**:  
Add to F09 backend tasks:

```
- [ ] GET /time-entries/daily-summary?date=&user_id= — returns:
  { date, total_hours, standard_hours, remaining_hours, entry_count,
    status: 'full' | 'partial' | 'missing' | 'day_off' }
  'full' = total_hours >= DAILY_STANDARD_HOURS - absences
  'partial' = 0 < total_hours < threshold
  'missing' = 0 hours AND working day
  'day_off' = Friday/Saturday/holiday
  Admin can pass any user_id; user can only query own.
```

---

### GAP-48 · F03 — `refresh_tokens` table described as "Optional" in F03 but is a mandatory migration in F02

**Affected**: `specs/F03-authentication.md`, `specs/F02-database-schema-migrations.md`

**Issue**:  
F03 Database Tables section reads: `"users table (password_hash, must_change_password, is_active). Optional: refresh_tokens table."`.  
F02 migration 016 creates `refresh_tokens` as a full mandatory migration with detailed schema including UNIQUE constraints. The "Optional" label in F03 contradicts this and could cause a developer to skip or conditionally include migration 016.

**Fix**:  
Update F03 database section to:  
`"Required: users table, refresh_tokens table (defined in F02 migration 016 — mandatory for JWT rotation and session invalidation)."`

---

### GAP-49 · F02 — `month_locks` table has no UNIQUE constraint on `(year, month)` 

**Affected**: `specs/F02-database-schema-migrations.md`

**Issue**:  
F02 migration 010 `month_locks` table has `(id, year int, month int, ...)` but no `UNIQUE(year, month)` constraint is specified.  
Without this constraint, a race condition between two concurrent admin requests to lock the same month would create duplicate lock rows. `POST /months/:year/:month/lock` would return a false 200 on one of the two and leave two conflicting rows for the same month.

**Fix**:  
Add to F02 migration 010 acceptance criteria and migration task:

```sql
CONSTRAINT uq_month_locks_year_month UNIQUE (year, month)
```

Also add to F02 acceptance criteria: `"month_locks.year + month combination is UNIQUE-constrained"`.

---

### GAP-50 · F14 — `RejectReasonDialog` shows a predefined-reasons dropdown but no source defined

**Affected**: `specs/F14-admin-report-review-approval.md`

**Issue**:  
F14's RejectReasonDialog UI spec reads: `"Rejection reason dropdown (predefined reasons): height: 48px, full-width"`.  
Nowhere in F14, F02, or any other spec is the list of predefined rejection reasons defined. There is no DB table, no ENUM, no system_settings key, no hardcoded list.  
A developer building this UI cannot populate the dropdown.

**Fix**:  
Choose one approach and document in F14:  
- **Option A (recommended)**: Hardcoded list of predefined reasons (stored in frontend constants + server validation):  
  - "שעות חסרות ביום X"  
  - "פרויקט/משימה שגויים"  
  - "חפיפה בשעות"  
  - "תיאור חסר"  
  - "אחר" (Other — free text required)  
- **Option B**: Admin-configurable table `rejection_reason_templates` with a new migration (018) and admin settings page  

If Option A: Update F14 to include the hardcoded list. The free-text textarea remains for "אחר" and additional comments.

---

### GAP-51 · F16 — Dashboard API says `in_progress` status but DB and UI both use `draft`

**Affected**: `specs/F16-admin-dashboard.md`, `specs/F02-database-schema-migrations.md`

**Issue**:  
F16's dashboard API response description (line 19) lists the cell statuses as: `not_started/in_progress/submitted/approved/rejected/missing`.  
F16's own SubmissionStatusTable color system uses `draft` (not `in_progress`): `draft | #FEF3C7 | #D97706 | טיוטה`.  
F02 migration 009 (via GAP-02 fix) defines `weekly_submissions.status` enum values as `draft/submitted/approved/rejected/missing`.  
Three sources disagree:
- F16 API response spec → `in_progress`  
- F16 UI color table → `draft`  
- F02 DB enum → `draft`

**Fix**:  
Replace `in_progress` with `draft` everywhere in F16 (API description and color coding). The canonical DB value is `draft`. Update F16 line 19 and the status colors list to use `draft` consistently.

---

### GAP-52 · F10 — `TIMER_LONG_RUNNING` notification type used for two different events (10h warning + 12h auto-stop)

**Affected**: `specs/F10-timer-feature.md`, `specs/F02-database-schema-migrations.md`

**Issue**:  
F10 uses `TIMER_LONG_RUNNING` for **two distinct events**:  
1. Line 23: 10h threshold warning — "timer is still running, be aware"  
2. Line 22: 12h auto-stop action — "your timer was automatically stopped"  

The deduplication rule ("max 1 per timer session") means if the 10h warning fires first, the 12h auto-stop notification is silently suppressed by the dedup check — the user never gets told their timer was force-stopped.  
These are semantically different events and should be distinct notification types.

**Fix**:  
Add `TIMER_AUTO_STOPPED` to the notification type ENUM in F02 migration 017 (in addition to `TIMER_LONG_RUNNING`):  
- `TIMER_LONG_RUNNING` → fires at 10h; deduped to 1 per session  
- `TIMER_AUTO_STOPPED` → fires at 12h auto-stop only; no dedup needed (happens once per session by definition)  

Update F10 cron task to use the correct type for each event. Update F02 migration 017 ENUM and F19 notification types list to include `TIMER_AUTO_STOPPED`.

---

### GAP-53 · F09 — `GET /time-entries/dropdown-data` doesn't specify how `sort_prefs` are applied

**Affected**: `specs/F09-daily-time-reporting.md`, `specs/F04-user-management-admin-.md`

**Issue**:  
F04 stores dropdown sort preferences via `POST /users/me/sort-preference` (JSONB frequency map in `users.sort_prefs`).  
F04's acceptance criteria says: `"Sort preference persisted and returned in dropdown-data endpoint"`.  
F09's `GET /time-entries/dropdown-data` task reads: `"returns user's available clients→projects→tasks tree based on assignments"` — with **no mention** of applying `sort_prefs`.  
A developer implementing `dropdown-data` won't know to read `users.sort_prefs` or how to apply it (sort by frequency? return prefs as a separate field? both?).

**Fix**:  
Add to F09 `GET /time-entries/dropdown-data` task:  
`"Response includes user's sort_prefs field. Clients/projects/tasks are sorted: most-recently/frequently-used first (from sort_prefs JSONB). Response shape: { clients: [...], sort_prefs: { client_id, project_id, task_id } }. Frontend pre-selects the sort_prefs values as defaults in the form dropdowns."`

---

## Fix Priority Order

When ready to fix specs (not implementation yet), apply in this order:

1. **F02** — largest surface: GAP-02, 03, 05, 06, 07, 20, 25, 27, 32 (9 schema gaps)  
2. **F03** — security + auth: GAP-01, 19  
3. **F14** — approval workflow: GAP-04, 11  
4. **F13** — cron correctness: GAP-08, 12  
5. **F12** — absence lifecycle: GAP-13, 22, 28  
6. **F17/F18** — audit/export: GAP-15, 16, 17  
7. **F19** — notifications/settings: GAP-10, 18, 34  
8. **F15** — lock workflow: GAP-10 (shared), 23  
9. **F16** — dashboard: GAP-14  
10. **F11** — report history: GAP-09, 29  
11. **F06/F07** — project + task forms: GAP-06, 07, 33  
12. **F09** — daily reporting: GAP-04 (shared), 30  
13. **F04** — user management: GAP-25, 27, 31  
14. **F08/F05/F01** — assignments, clients, infra: GAP-21, 20, 26  
15. **figma-design-spec.md** — route map: GAP-29, 35  
