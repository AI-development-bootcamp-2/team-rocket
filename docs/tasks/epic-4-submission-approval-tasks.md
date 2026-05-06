# Epic 4 — Submission & Approval Lifecycle Tasks

**Jira Epic**: `[EPIC] Submission & Approval Lifecycle — Monthly Submit, Approve/Reject, Timer`  
**Priority**: Critical | **Day**: 5  
**Spec**: [epic-4-submission-approval.md](../specs/epic-4-submission-approval.md)

---

## Story F13-BE — Monthly Submission Backend
**Assignee**: Dev A  
**Story Points**: 8

### Tasks
- [ ] **T** Implement `GET /monthly-submissions` — list submissions (filter: user_id, year, month, status)
- [ ] **T** Implement `GET /monthly-submissions/:id` — get single submission
- [ ] **T** Implement `POST /monthly-submissions/:id/submit` — submit month
- [ ] **T** Implement `GET /monthly-summary` — month status + quota progress
- [ ] **T** Enforce submit pre-checks: all working days fully allocated, no running timer, month not locked
- [ ] **T** Return list of incomplete days when submit is blocked
- [ ] **T** Implement state machine: enforce valid transitions only (draft/missing → submitted → approved/rejected)
- [ ] **T** Implement nightly deadline job: auto-flag `draft` months as `missing` after last working day 23:59
- [ ] **T** Compute last working day of month using `holiday_calendar` + non-working-day config

#### Subtasks
- [ ] **ST** Unit test: state machine — all valid transitions allowed, invalid transitions return 409
- [ ] **ST** Integration test: submit success — all days allocated, no timer running
- [ ] **ST** Integration test: submit blocked — incomplete day, returns list of offending days
- [ ] **ST** Integration test: submit blocked — running timer, correct error message
- [ ] **ST** Integration test: submit blocked — month already submitted/approved
- [ ] **ST** Integration test: auto-flag job — unsubmitted month → `missing` after deadline
- [ ] **ST** Integration test: `missing` month can still be submitted by user

---

## Story F13-FE — Monthly Submission Frontend
**Assignee**: Dev C  
**Story Points**: 5

### Tasks
- [ ] **T** Build `MonthlySubmitButton` on monthly view screen
- [ ] **T** Implement enabled/disabled logic with tooltip explaining the specific block reason
- [ ] **T** Build `QuotaProgressBar` — green / yellow / red thresholds
- [ ] **T** Show running timer warning when timer is active
- [ ] **T** Build submit confirmation dialog: "Submit May 2026? You won't be able to edit after this."
- [ ] **T** After submission: update UI to submitted/read-only state

#### Subtasks
- [ ] **ST** UI test: button disabled + tooltip when day incomplete
- [ ] **ST** UI test: button disabled + timer warning when timer running
- [ ] **ST** UI test: button disabled when month already submitted
- [ ] **ST** UI test: confirmation dialog shown before submit fires

---

## Story F14-BE — Approval & Rejection Backend
**Assignee**: Dev B  
**Story Points**: 8

### Tasks
- [ ] **T** Implement `POST /monthly-submissions/:id/approve` — Admin approves month
- [ ] **T** Implement `POST /monthly-submissions/:id/reject` — Admin rejects month (with reason)
- [ ] **T** Implement `POST /time-entries/:id/approve` — Admin approves single entry
- [ ] **T** Implement `POST /time-entries/:id/reject` — Admin rejects single entry (reason mandatory)
- [ ] **T** On entry rejection: set entry status to `rejected`, move monthly submission to `rejected`
- [ ] **T** Enforce: rejection reason is mandatory — return 422 if missing
- [ ] **T** Implement Admin edit of any user's time entry (audit logged, badge flagged)
- [ ] **T** Trigger in-app notification on rejection
- [ ] **T** Trigger email notification on rejection

#### Subtasks
- [ ] **ST** Integration test: approve month → status `approved`, reviewer + timestamp recorded
- [ ] **ST** Integration test: approve blocked for non-submitted month → error
- [ ] **ST** Integration test: reject entry without reason → 422 error
- [ ] **ST** Integration test: reject entry → monthly submission moves to `rejected`
- [ ] **ST** Integration test: user corrects entry + resubmits → `submitted`
- [ ] **ST** Permission test: only admin can approve/reject
- [ ] **ST** Audit log: approve, reject (with reason), resubmission all logged

---

## Story F14-FE — Approval & Rejection Frontend (Admin)
**Assignee**: Dev D  
**Story Points**: 8

### Tasks
- [ ] **T** Build Admin review screen: user name, month, submission timestamp, full entry list
- [ ] **T** Show total hours for the month on review screen
- [ ] **T** Build "Approve Month" button with confirmation
- [ ] **T** Build "Reject Entry" button + `RejectReasonDialog` (mandatory reason input)
- [ ] **T** Highlight rejected entries (red border) with inline rejection reason
- [ ] **T** Show "Modified by Admin" badge on entries edited by admin
- [ ] **T** On rejection: re-enable edit button on the affected entry for the user
- [ ] **T** After user corrects entry: show "Resubmit Month" button

#### Subtasks
- [ ] **ST** UI test: reject dialog blocks submission if reason field is empty
- [ ] **ST** UI test: rejected entry shows red highlight + visible reason text
- [ ] **ST** UI test: "Modified by Admin" badge visible to user with before/after on click

---

## Story F10 — Timer (Full-Stack)
**Assignee**: Dev B  
**Story Points**: 5

### Tasks
- [ ] **T** BE: `GET /timer` — get current timer state (running or null)
- [ ] **T** BE: `POST /timer/start` — start timer, fails with 409 if one already running
- [ ] **T** BE: `POST /timer/stop` — stop timer, return start/stop/duration
- [ ] **T** BE: Auto-stop timer after 12 hours of continuous running (cron/scheduled job)
- [ ] **T** BE: Send in-app reminder notification after 10 hours of running
- [ ] **T** FE: Start/Stop button on daily report screen
- [ ] **T** FE: Running state — live elapsed time counter, stop button
- [ ] **T** FE: Completion dialog on stop — client, project, task, location, description fields (all required)
- [ ] **T** FE: On completion dialog submit → create time entry with timer start/stop times

#### Subtasks
- [ ] **ST** Integration test: `POST /timer/start` — fails if timer already running → 409
- [ ] **ST** Integration test: `POST /timer/stop` — creates correct time entry
- [ ] **ST** Integration test: auto-stop after 12 hours
- [ ] **ST** Integration test: timer state persists across page refresh (server-side)
- [ ] **ST** Integration test: monthly submission blocked when timer running

---

**✅ Milestone**: Full lifecycle — employee submits month → admin reviews → approved or rejected.
