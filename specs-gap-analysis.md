# Specs Gap Analysis vs v3.2 FINAL
**Ground truth**: `Time_Report_Master_Spec_v3.2_FINAL.docx`  
**Method**: Each F-spec read line-by-line and compared to v3.2 FINAL sections.  
**Status legend**: ⬜ Not closed · ✅ Closed

> **All gaps below have been closed directly in the respective spec files (May 2026).**

---

## Summary Table

| Spec | Title | Gaps | Severity |
|------|-------|------|----------|
| F01 | Project Setup & Infrastructure | 4 | 🟡 Medium |
| F02 | Database Schema & Migrations | 4 | 🔴 Critical |
| F03 | Authentication | 3 | 🟠 High |
| F04 | User Management | 3 | 🟡 Medium |
| F05 | Client Management | 2 | 🟡 Medium |
| F06 | Project Management | 2 | 🟡 Medium |
| F07 | Task Management | 3 | 🟠 High |
| F08 | User-Task Assignments | 2 | 🟡 Medium |
| F09 | Daily Time Reporting | 5 | 🔴 Critical |
| F10 | Timer Feature | 3 | 🟠 High |
| F11 | Monthly View & Report History | 3 | 🟠 High |
| F12 | Absence Reporting | 2 | 🟡 Medium |
| F13 | Weekly Submission | 4 | 🔴 Critical |
| F14 | Admin Report Review & Approval | 3 | 🔴 Critical |
| F15 | Month Lock/Unlock | 2 | 🟡 Medium |
| F16 | Admin Dashboard | 2 | 🟡 Medium |
| F17 | Audit Log | 2 | 🟡 Medium |
| F18 | Export (Excel/PDF) | 2 | 🟡 Medium |
| F19 | Notifications & Holiday Settings | 4 | 🔴 Critical |

---

## Cross-Cutting Gap (affects ALL specs)

> **v3.2 Section 14.1 defines 14 required UI states** that every frontend feature must implement. Not a single F-spec enumerates these states in its frontend tasks.

The 14 states that must be added to every frontend section:
1. Loading (skeleton)
2. Empty (no data)
3. No-permission (403)
4. Validation error (inline field errors)
5. Server error (500 toast)
6. Offline indicator
7. Save success (toast)
8. Submit success
9. Rejection notice (with reason)
10. Locked month (read-only banner)
11. Delete confirmation dialog
12. Unsaved changes warning (before navigate away)
13. Disabled control (tooltip explaining why)
14. Quota warning (approaching/exceeding limit)

**How to close**: Add a "UI States" sub-section to each spec's frontend task list that checks off the applicable states from the 14 above.

---

## F01 — Project Setup & Infrastructure

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | No task for CORS configuration (restrict to known frontend domain) | Section 3 security requirements | Add backend task: `Configure CORS middleware — allow only FRONTEND_URL env var` |
| 2 ⬜ | No task for rate limiting middleware (100 req/min global, 10 login/min per IP) | Section 3 | Add backend task: `express-rate-limit middleware — global + per-route on POST /auth/login` |
| 3 ⬜ | No cron job infrastructure task | Sections 8, 10, 13 all rely on crons | Add backend task: `Set up node-cron scheduler module — register: Sunday 23:59 auto-flag cron, Thursday reminder email cron, 12h timer auto-stop cron` |
| 4 ⬜ | No task for file storage setup (for absence document uploads) | Section 9 (Absence Reporting) | Add infra task: `Configure multer + local file storage (or S3) for document uploads — define max 5MB, types: jpg/png/pdf` |

---

## F02 — Database Schema & Migrations

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | `users` table missing `failed_login_attempts INT DEFAULT 0` and `lockout_until TIMESTAMPTZ` columns | Section 3 (lockout after 5 attempts) | Add columns to migration 001 users table |
| 2 ⬜ | No `refresh_tokens` table migration | Section 3 (JWT refresh token storage) | Add migration: `refresh_tokens (id, user_id FK, token_hash, expires_at, revoked_at, ip_address, user_agent)` — or document if using Redis instead |
| 3 ⬜ | No `notifications` table migration (F19 says "create notifications table" but F02 doesn't define it) | Section 10 | Add migration 016: `notifications (id, user_id FK, type ENUM, title, body, related_entity_type, related_entity_id, is_read BOOL, created_at)` |
| 4 ⬜ | `month_locks` table has no `unlock_reason TEXT` column — F15 requires unlock reason to be stored | Section 15 (unlock with mandatory reason) | Add `unlock_reason TEXT` column to month_locks migration |

---

## F03 — Authentication

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | No task for HTTPS enforcement / HSTS header | Section 3 security | Add task: `helmet.js middleware — set HSTS, X-Content-Type-Options, X-Frame-Options` |
| 2 ⬜ | "Change password invalidates all other sessions" is not explicitly tasked | Section 3 | Add backend task: `On password change — revoke all existing refresh tokens for that user_id` |
| 3 ⬜ | `POST /auth/login` error message behavior not specified — should return generic "Invalid credentials" (not reveal which field is wrong) | Security best practice + OWASP A07 | Add AC: `Login error always returns 401 with generic message 'Invalid email or password' regardless of which field is wrong` |

---

## F04 — User Management

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | No mention of "cannot deactivate self" rule in acceptance criteria (it exists in tasks but not enforced in AC) | Section 4 | Add AC: `Admin cannot deactivate their own account — returns 400 with message` |
| 2 ⬜ | No user sort-preference storage — v3.2 says dropdown sort preference is persisted per user | Section 5.3 | Add task: `POST /users/me/sort-preference — store {client_id, project_id, task_id} frequency map in system_settings keyed per user` (or add `sort_prefs JSONB` column to users table) |
| 3 ⬜ | No `PUT /users/me` endpoint — users should be able to update their own display name/email | Section 4 | Decide and document: either "users cannot self-edit in v1" (close the gap by stating it explicitly) or add the endpoint |

---

## F05 — Client Management

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | No mention of duplicate name behavior — v3.2 says "duplicate names: warn but allow" | Section 6 Delete/Archive Policy | Add backend task: `POST /clients — if name already exists (case-insensitive), return 200 with `{ warning: 'A client with this name already exists' }` alongside the created record` |
| 2 ⬜ | No cascade rule: archiving a client makes all its projects and tasks disappear from user reporting dropdowns | Section 6, Section 7 | Add AC: `Archived client's projects and tasks are excluded from all user-facing dropdowns (GET /projects?active=true, GET /tasks?active=true)` |

---

## F06 — Project Management

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | No cascade rule: archiving a project makes all its tasks unreportable | Section 6 | Add AC: `Archived project's tasks are excluded from all user-facing dropdowns` |
| 2 ⬜ | No mention that only Admin can create projects — `canAssignProjectTasks` flag does NOT grant project creation | Section 4 (Roles & Permissions) | Add AC: `Only Admin role can create/edit/archive projects. canAssignProjectTasks flag does not apply here.` |

---

## F07 — Task Management

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | Missing `GET /tasks/:id` endpoint | Standard REST, referenced in F08/F09 | Add endpoint to API table: `GET /tasks/:id — returns task + parent project + parent client info` |
| 2 ⬜ | No clarification of what happens to user-task assignments when a task is closed | Section 6 (Delete/Archive Policy) | Add AC: `Closing a task sets its status to 'closed'. Existing user-task assignments remain in DB but the task is excluded from reporting dropdowns. User keeps historical entries.` |
| 3 ⬜ | Only 2 tests — very thin test coverage for a critical data entity | Section 1 (60% coverage) | Add tests: `Closed task not returned in GET /tasks?status=open`, `Closed task blocked in POST /time-entries`, `GET /tasks/:id returns 404 for non-existent task` |

---

## F08 — User-Task Assignments

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | No UI description for how `canAssignProjectTasks` users see a restricted project/task selector (only their scoped projects) | Section 4 | Add frontend task: `AssignmentForm.jsx — if current user has canAssignProjectTasks flag, fetch only scoped projects for dropdown; show scope-limited picker` |
| 2 ⬜ | No `GET /assignments/:id` endpoint | Standard REST | Add endpoint: `GET /user-task-assignments/:id` — needed for edit form |

---

## F09 — Daily Time Reporting

**This is the highest-priority spec to close. 5 concrete gaps.**

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | **Optimistic locking not implemented** — PUT /time-entries/:id must check `version` field; if mismatch return 409 Conflict | Section 13 (Concurrency Rules) | Add backend task: `PUT /time-entries/:id — require version field in body. If DB version !== body.version → 409 { error: 'CONFLICT', message: 'Entry was modified by someone else. Please reload.' }` |
| 2 ⬜ | **Manual duration input not specified** — v3.2 says both start/end time AND manual duration are supported; start/end is source of truth when both provided | Section 7 | Add field `duration_override_minutes` to form. Add AC: `If start_time + end_time provided, duration is auto-calculated and duration_override ignored. If only duration_override provided, start_time is required and end_time is derived.` |
| 3 ⬜ | **Weekly submission lock not enforced** — spec says entries are blocked after week is submitted, not just after month lock | Section 8 | Change PUT/DELETE AC from `"only if month not locked"` to `"only if month not locked AND week status is draft/rejected"` |
| 4 ⬜ | **"Modified by Admin" badge missing** — when admin edits a user's entry, that entry must show a badge | Section 12.3, Section 14.1 | Add frontend task: `TimeEntryCard.jsx — if entry.last_modified_by_role === 'admin', show 'Modified by Admin' badge with audit log tooltip` |
| 5 ⬜ | **Unsaved changes dialog missing** from frontend tasks | Section 14.1 required UI state #12 | Add frontend task: `TimeEntryForm.jsx — intercept navigation away when form is dirty. Show dialog: 'You have unsaved changes. Leave anyway?'` |

---

## F10 — Timer Feature

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | 10h warning is mentioned but not connected to F19 notification system — it should create an in-app notification | Section 10 (Notification types) | Add backend task: `Timer cron: when timer.duration >= 10h, call notificationsService.create({ type: 'TIMER_LONG_RUNNING', userId })` |
| 2 ⬜ | Completion dialog doesn't validate for entry overlaps before saving | Section 7 (overlap detection) | Add AC: `TimerStopDialog submit → calls same overlap check as POST /time-entries. Returns 409 if overlap detected.` |
| 3 ⬜ | Auto-stop at 12h should create audit log entry | Section 12.2 (event types) | Add AC: `Auto-stop cron logs audit event: actor=SYSTEM, action=TIMER_AUTO_STOPPED, old_value={ start_time }, new_value={ end_time, duration_minutes }` |

---

## F11 — Monthly View & Report History

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | **"Modified by Admin" badge not shown on monthly view** | Section 12.3, Section 14.1 | Add frontend task: `DayDetailSheet.jsx — entries modified by admin show 'Modified by Admin' badge (same as F09)` |
| 2 ⬜ | Week submission status not shown on monthly calendar | Section 8 (weekly submission lifecycle) | Add frontend task: `MonthlyCalendar.jsx — group days into ISO weeks. Show a week-status pill (draft / submitted / approved / rejected) per week row.` |
| 3 ⬜ | KPI summary cards (shown in webapp designs) have no backend endpoint | Design audit, Section 5 | Add backend task: `GET /reports/monthly-summary?user_id=&year=&month= → returns { total_hours, vacation_days, sick_days, missing_days, reported_projects[] }` |

---

## F12 — Absence Reporting

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | **Optimistic locking not on absence_entries** — same concurrency gap as F09 | Section 13 | Add `version INT DEFAULT 0` to absence_entries schema (close in F02) and add version check to PUT /absence-entries/:id |
| 2 ⬜ | Document download link not in AbsenceList UI | Section 9 (attachments) | Add frontend task: `AbsenceCard.jsx — if absence has attachments, show download link(s). Use GET /absences/:id/attachments → stream file.` |

---

## F13 — Weekly Submission

**Critical gap: resubmission flow is completely undefined.**

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | **No resubmit endpoint** — after rejection and correction, user has no way to re-submit the week | Section 8, Section 14 | Add endpoint: `POST /weekly-submissions/:id/resubmit` — validates: status=rejected, all entries are re-reviewed (status=draft). Sets status back to 'submitted'. Audit logged. |
| 2 ⬜ | **Week start day not defined** — system uses `week_start_date` but Sunday vs Monday is ambiguous | Israeli work week = Sunday | Add AC: `week_start_date is always a Sunday (day 0 in JS). Crons and queries use Sunday-to-Saturday as the week window.` |
| 3 ⬜ | Auto-creation of weekly_submission records is undefined — when does the record get created? | Section 8 | Add AC: `weekly_submission record created lazily on first time_entry save for that week, OR eagerly by cron on week start. Define which approach.` |
| 4 ⬜ | Monthly quota exceeded block not implemented — v3.2 says submission blocked if quota exceeded (unless admin exception) | Section 7, Section 8 | Add validation: `Before status → 'submitted': calculate total monthly hours. If > monthly_quota_hours (system setting) → return 422 { error: 'QUOTA_EXCEEDED' }`. Note: the Admin exception approval path is not specced anywhere — flag as open decision. |

---

## F14 — Admin Report Review & Approval

**Critical gap: resubmission is defined here but the endpoint lives in F13.**

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | **Resubmission flow missing** — after user fixes a rejected entry, there is no defined endpoint or UX for re-submitting | Section 8 | Add task: `Frontend: WeekDetailPage.jsx — if week status is 'rejected', show 'Resubmit Week' button. Calls POST /weekly-submissions/:id/resubmit (defined in F13)` |
| 2 ⬜ | **Admin edit of a user's entry is not a distinct flow** — F14 covers approve/reject but not direct admin edit (with Modified-by-Admin audit trail) | Section 12.3 | Add task: `PUT /time-entries/:id (Admin role) — admin can edit any user's draft entry. Audit log: action=ADMIN_EDIT, actor=admin, target=entry_id. Sets a flag or metadata that triggers Modified-by-Admin badge in UI.` |
| 3 ⬜ | In-app notification on rejection not connected to F19 — F14 calls the email but not the in-app notification | Section 10 | Add task: `On week rejection: call notificationsService.create({ type: 'WEEK_REJECTED', userId, reason, weekStartDate })` |

---

## F15 — Month Lock/Unlock

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | `unlock_reason` not in month_locks DB schema — F15 requires it stored but F02 migration doesn't have it | Section 15 | Close in F02: add `unlock_reason TEXT` column. Add AC in F15: `Unlock reason is stored in month_locks.unlock_reason AND in audit_log.reason` |
| 2 ⬜ | No cross-reference to F18 payroll export auto-lock — the lock mechanism must be shared | Section 11 (payroll export triggers lock) | Add note: `Month lock can be triggered from two places: (1) Admin manual lock via POST /months/:year/:month/lock (this feature), (2) Payroll export in F18 which calls the same lock logic. Shared via monthLocksService.lock(year, month, adminId)` |

---

## F16 — Admin Dashboard

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | No week-level filter — only month filter. Admin may need to jump to a specific week | Section 16 usability | Add task: `Dashboard month selector also has week quick-jump — clicking a week header scrolls/filters to that week` |
| 2 ⬜ | "Not started" vs "Missing" distinction is not defined — both mean no entries but different triggers | Section 8 (auto-flag cron) | Add AC: `'not_started' = no entries + week has not passed Sunday deadline. 'missing' = no entries + Sunday 23:59 has passed (auto-flagged by cron). Different color in matrix.` |

---

## F17 — Audit Log

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | "Modified by Admin" badge appears in F17 UI description but no other spec implements it in their UI | Section 12.3 | Add note: `The 'Modified by Admin' badge in the audit log viewer is one access point. The badge ALSO must appear in F09 (TimeEntryCard), F11 (DayDetailSheet), and F14 (AdminWeekDetail). Cross-reference these specs.` |
| 2 ⬜ | IP address capture not detailed — reverse proxy may mask real IP | Security | Add implementation note: `Extract IP from req.headers['x-forwarded-for'] || req.socket.remoteAddress. Validate format. Store raw string.` |

---

## F18 — Export (Excel/PDF)

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | "Correction history" in export columns has no implementation — it requires querying audit_logs per entry | Section 11 | Add backend task: `Export query: for each time_entry, JOIN audit_logs WHERE action IN ('ADMIN_EDIT','ENTRY_CORRECTED') AND target_entity_id = entry.id. Include as sub-rows or notes column in export.` |
| 2 ⬜ | No file naming convention defined — downloads appear as generic file names | UX | Add AC: `Export filename format: YYYY-MM_[user_name]_[report_type].[ext] e.g. '2026-03_John_Smith_monthly.xlsx'` |

---

## F19 — Notifications & Holiday Settings

**Critical: F02 does not create the notifications table. F10's 10h trigger is not listed here.**

### Gaps

| # | Gap | v3.2 Reference | How to Close |
|---|-----|----------------|--------------|
| 1 ⬜ | **`notifications` table migration missing from F02** | Section 10 | Close in F02 (gap already listed there). F19 should cross-reference: `Depends on F02 migration 016 (notifications table)` |
| 2 ⬜ | **Timer 10h reminder notification not listed** as an explicit notification type | Section 10 | Add to backend notification types enum and frontend NotificationList: `TIMER_LONG_RUNNING` — "Your timer has been running for 10 hours" |
| 3 ⬜ | **Quota warning notification** trigger not implemented — who fires it and when? | Section 10 | Add backend task: `On every time_entry save: if user's monthly_hours >= (quota * 0.9), create notification { type: 'QUOTA_WARNING' }. Deduplicate: only 1 per user per month.` |
| 4 ⬜ | `system_settings` keys not enumerated — F19 exposes `PUT /settings` but what keys exist? | Section 16 (System Constants) | Add AC: `System settings keys: DAILY_STANDARD_HOURS (default: 9), WEEKLY_SUBMISSION_DEADLINE_DAY (default: Sunday), MONTHLY_QUOTA_HOURS (default: 182), TIMER_AUTO_STOP_HOURS (default: 12), TIMER_WARNING_HOURS (default: 10)` |

---

## Closing Priority Order

Work through these in this order to unblock downstream features:

| Priority | Spec | Why First |
|----------|------|-----------|
| 1 | **F02** | All other specs depend on the DB schema. Add missing columns + notifications table now. |
| 2 | **F09** | Core product feature. Optimistic locking + weekly lock enforcement must be right. |
| 3 | **F13** | Resubmission endpoint is a blocker for F14 to be complete. |
| 4 | **F14** | Admin edit flow (Modified-by-Admin) affects F09, F11, F17 UI. |
| 5 | **F19** | Notifications table + 2 missing notification types unblock F10 and F09 quota warning. |
| 6 | **F03** | HTTPS/HSTS + session invalidation on password change. |
| 7 | **F01** | Rate limiting + cron infra needed before any cron-dependent feature is built. |
| 8 | F07, F10, F11, F12 | Mid-priority individual fixes |
| 9 | F04–F06, F08, F15–F18 | Minor additions and edge cases |

---

*Generated by Copilot audit vs `Time_Report_Master_Spec_v3.2_FINAL.docx`*
