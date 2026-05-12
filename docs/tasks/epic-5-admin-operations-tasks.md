# Epic 5 — Admin Operations & Polish Tasks

**Jira Epic**: `[EPIC] Admin Operations — Lock, Dashboard, Audit Log, Export, Notifications`  
**Priority**: HIGH (F15, F16) / MEDIUM (F17, F18) / LOW (F19) | **Day**: 6  
**Spec**: [epic-5-admin-operations.md](../specs/epic-5-admin-operations.md)

> ⚠️ F18 and F19 are best-effort — only ship if Epics 1–4 are solid.

---

## Story F15 — Month Lock / Unlock
**Assignee**: Dev A (BE) / Dev D (FE)  
**Priority**: HIGH  
**Story Points**: 5

### Backend Tasks

#### DB / Schema
- [x] **T** BE: Create `month_locks` table with columns: `year`, `month`, `is_locked`, `locked_by`, `locked_at`, `unlocked_by`, `unlocked_at`, `unlock_reason`

#### Shared Service (`server/src/modules/month-locks/monthLocksService`)
- [x] **T** BE: Implement `monthLocksService.lock(year, month, adminId)` — sets `is_locked=true`, records `locked_by` + `locked_at`, writes audit log, triggers notification fan-out
- [x] **T** BE: Implement `monthLocksService.unlock(year, month, adminId, reason)` — validates reason is non-empty (throws 422 if missing), sets `is_locked=false`, records `unlocked_by` + `unlocked_at`, stores reason in `month_locks.unlock_reason` AND `audit_logs.reason`, writes audit log
- [x] **T** BE: Both methods are the single source of lock logic — F18 payroll export calls `lock()` from this same service, no duplication

#### Endpoints
- [x] **T** BE: `POST /admin/months/:year/:month/lock` (Admin only) — calls `monthLocksService.lock()`; lock always succeeds regardless of unapproved weeks; does NOT return 422 for unapproved weeks
- [x] **T** BE: `POST /admin/months/:year/:month/unlock` (Admin only) — calls `monthLocksService.unlock()`; returns 422 if reason is absent or empty
- [x] **T** BE: `GET /admin/months/:year/:month/status` (User/Admin) — returns `is_locked`, `locked_by`, `locked_at`, `unapproved_week_count` (used by frontend before showing lock confirmation dialog)
- [x] **T** BE: `GET /admin/months` (Admin) — list all months with their lock status

#### Month Lock Enforcement
- [x] **T** BE: Add lock-check middleware/guard to all time entry create/edit/delete mutations — return `423 Locked` if the affected month is locked
- [ ] **T** BE: Add lock-check middleware/guard to all absence create/edit/delete mutations — return `423 Locked` if the affected month is locked

#### Notifications (background, non-blocking)
- [x] **T** BE: On lock, fan out `LOCKED_MONTH` notification to all active users: `SELECT id FROM users WHERE is_active=true` → one `notificationsService.create(...)` call per user, awaited after response is sent (background)

#### Audit Log
- [x] **T** BE: Lock action: write audit log entry with actor (admin ID), action `LOCK_MONTH`, month/year, timestamp
- [x] **T** BE: Unlock action: write audit log entry with actor, action `UNLOCK_MONTH`, month/year, timestamp, and reason

### Frontend Tasks
- [ ] **T** FE: `MonthLockPage.jsx` — admin screen with month selector grid/dropdown
- [ ] **T** FE: Per-month row: status badge (open/locked), lock date, locked-by, approved week count, unapproved week count
- [ ] **T** FE: Before locking — call `GET /admin/months/:year/:month/status`; if `unapproved_week_count > 0` show `LockConfirmDialog` warning; admin can proceed anyway
- [ ] **T** FE: `LockConfirmDialog` — confirmation modal; lock button always enabled (warning shown but not blocking)
- [ ] **T** FE: `UnlockReasonDialog` — mandatory reason textarea; inline validation error if empty
- [ ] **T** FE: All required UI states: loading skeleton, validation error, success toast ('החודש נעול' / 'החודש נפתח'), server error toast
- [ ] **T** FE: User-facing locked month banner on `MonthlyViewPage` — disable all edit/delete/submit actions; grey out fields with tooltip 'Month is locked'

### Tests

#### Integration Tests
- [x] **ST** Lock succeeds even when unapproved weeks exist (no 422, no block)
- [x] **ST** `GET /admin/months/:year/:month/status` returns correct `unapproved_week_count`
- [x] **ST** Unlock without reason (or empty reason) returns 422
- [x] **ST** Lock records `locked_by` and `locked_at` in `month_locks`
- [x] **ST** Unlock stores reason in both `month_locks.unlock_reason` and `audit_logs.reason`
- [x] **ST** Time entry create/edit/delete on a locked month returns 423
- [ ] **ST** Absence create/edit/delete on a locked month returns 423
- [x] **ST** Lock triggers `LOCKED_MONTH` notification fan-out for all active users
- [x] **ST** Lock and unlock events each produce a correct audit log record with actor + timestamp
- [x] **ST** `monthLocksService.lock()` is callable independently (reusable by F18 payroll export)

---

## Story F16 — Admin Dashboard
**Assignee**: Dev C  
**Priority**: HIGH  
**Story Points**: 5

### Tasks
- [ ] **T** BE: `GET /dashboard?year=&month=` — monthly submission status for all users
- [ ] **T** FE: Build dashboard table — one row per user, monthly submission status chip
- [ ] **T** FE: Status chips: not started (grey) / in progress (blue) / submitted (yellow) / approved (green) / rejected (red) / missing (orange)
- [ ] **T** FE: Summary counts at top — pending review, rejected, missing
- [ ] **T** FE: Click user row → navigate to that user's monthly review screen
- [ ] **T** FE: Click "Pending Reviews" count → filtered list of submitted monthly submissions

#### Subtasks
- [ ] **ST** Integration test: dashboard response includes correct status per user for the month
- [ ] **ST** UI test: status chips render correct color for each status
- [ ] **ST** UI test: click user row navigates to correct review screen

---

## Story F17 — Audit Log
**Assignee**: Dev B (BE) / Dev D (FE)  
**Priority**: MEDIUM  
**Story Points**: 8

### Tasks
- [ ] **T** BE: Implement audit middleware — auto-logs all state-changing API calls
- [ ] **T** BE: Log: login success + failure
- [ ] **T** BE: Log: create/edit/archive time entry, absence, client, project, task, user, assignment
- [ ] **T** BE: Log: submit/approve/reject monthly submission (with reason on reject)
- [ ] **T** BE: Log: reopen locked month (with reason)
- [ ] **T** BE: Log: change user role / grant or revoke permission flag
- [ ] **T** BE: Log: export report
- [ ] **T** BE: Log: upload/remove absence document (especially after lock)
- [ ] **T** BE: Log: admin edit of another user's report
- [ ] **T** BE: Log: deactivate/reactivate user
- [ ] **T** BE: Log: password reset
- [ ] **T** BE: `GET /audit-logs` — filterable list (actor, entity type, action, date range, pagination)
- [ ] **T** FE: Audit log viewer — filterable table with expand-row for old/new JSON diff

#### Subtasks
- [ ] **ST** Audit test: every event in the F17 list creates a correct audit record
- [ ] **ST** Audit test: records include old + new values on updates
- [ ] **ST** Audit test: rejection reason stored in audit record
- [ ] **ST** Integration test: `GET /audit-logs` filters work correctly
- [ ] **ST** Permission test: only admin can view audit logs

---

## Story F18 — Export Excel / PDF *(best-effort)*
**Assignee**: Dev A  
**Priority**: MEDIUM  
**Story Points**: 5

### Tasks
- [ ] **T** BE: `GET /exports?month=&userId=&format=` — generate and download export
- [ ] **T** BE: Implement Excel export using `exceljs` — all required fields per row
- [ ] **T** BE: Implement PDF export using `pdfkit` or `jsPDF`
- [ ] **T** BE: Add "NOT APPROVED" watermark/header to exports of unapproved months
- [ ] **T** BE: Final payroll export of approved month auto-locks the month
- [ ] **T** BE: Every export includes digital timestamp + generating admin ID
- [ ] **T** BE: Every export action audit logged
- [ ] **T** FE: Export screen — select month, user, project, client, format (xlsx/pdf)

#### Subtasks
- [ ] **ST** Integration test: Excel export contains all required fields
- [ ] **ST** Integration test: unapproved export includes "NOT APPROVED" header
- [ ] **ST** Integration test: approved export auto-locks month
- [ ] **ST** Integration test: export action creates audit log record
- [ ] **ST** Performance test: full-month all-users export completes in < 30 seconds

---

## Story F19 — Notifications + Holiday Settings *(best-effort)*
**Assignee**: Dev B  
**Priority**: LOW  
**Story Points**: 5

### Tasks
- [ ] **T** BE: In-app notification on entry rejection (with reason)
- [ ] **T** BE: In-app notification / banner when month is locked
- [ ] **T** BE: In-app alert on daily view for missing report days
- [ ] **T** BE: In-app quota warning when approaching monthly limit
- [ ] **T** BE: "Modified by Admin" badge flag on admin-edited entries
- [ ] **T** BE: Email — send on last working day of month if monthly submission not submitted
- [ ] **T** BE: Email — send on admin rejection of entries
- [ ] **T** BE: `GET/POST/DELETE /settings/holidays` — holiday calendar CRUD
- [ ] **T** BE: `GET/PUT /settings/calendar` — work schedule settings (standard hours, non-working days)
- [ ] **T** FE: Notification inbox / indicator in nav bar
- [ ] **T** FE: Holiday calendar admin screen — calendar view + "Add Holiday" form
- [ ] **T** FE: Work settings panel — daily standard hours, non-working day checkboxes (Sun–Sat)

#### Subtasks
- [ ] **ST** Integration test: missing month triggers email on last working day if not submitted
- [ ] **ST** Integration test: admin rejection triggers in-app + email notification
- [ ] **ST** Integration test: adding a holiday reduces quota calculation for that month
- [ ] **ST** UI test: notification indicator shows unread count in nav bar

---

**✅ Milestone**: Production-ready core system. F18/F19 best-effort only if E1–E4 are solid.
