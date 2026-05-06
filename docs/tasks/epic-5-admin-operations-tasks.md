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

### Tasks
- [ ] **T** BE: `GET /months` — list months with lock status
- [ ] **T** BE: `POST /months/:yearMonth/lock` — lock month (blocked if any user's monthly submission not approved)
- [ ] **T** BE: `POST /months/:yearMonth/unlock` — unlock month (requires mandatory reason)
- [ ] **T** BE: `GET /months/:yearMonth/status` — approval status per user (monthly submission)
- [ ] **T** BE: On lock — all time entries and absences for that month become read-only
- [ ] **T** BE: On unlock — entries return to pre-lock status, audit logged with reason
- [ ] **T** FE: Month selector screen (dropdown or calendar picker)
- [ ] **T** FE: Status table — one row per user, their monthly submission status
- [ ] **T** FE: Lock button disabled until all users are `approved`; tooltip explains why
- [ ] **T** FE: Unlock button with mandatory reason input modal

#### Subtasks
- [ ] **ST** Integration test: lock blocked — returns list of users with unapproved submissions
- [ ] **ST** Integration test: lock succeeds — all edits rejected for all users for that month
- [ ] **ST** Integration test: unlock — requires reason, entries return to pre-lock status
- [ ] **ST** Integration test: payroll export auto-locks month
- [ ] **ST** Audit log: lock and unlock events logged with actor + reason

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
