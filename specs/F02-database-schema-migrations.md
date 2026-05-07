# F02: Database Schema & Migrations

| | |
|---|---|
| **Phase** | 1 |
| **Sprint** | Sprint 1 |
| **Assigned to** | Dev A (Backend Lead) |
| **Severity** | CRITICAL |
| **Depends on** | F01 |

## Summary

Create all database tables, indexes, and seed data. This unblocks all backend feature work.

## Tasks & Subtasks

### 1. Set up migration system

- [x] Install Knex.js or similar migration tool
- [x] Configure connection to Docker PostgreSQL
- [x] Create migration runner script
- [x] Add migrate command to package.json

### 2. Core entity migrations

- [x] 001_create_users (id, email, password_hash, **first_name VARCHAR(100) NOT NULL**, **last_name VARCHAR(100) NOT NULL**, role **ENUM('admin','user') NOT NULL DEFAULT 'user'**, is_active, must_change_password, **failed_login_attempts INT DEFAULT 0**, **lockout_until TIMESTAMPTZ NULL**, **sort_prefs JSONB NULL**, **employee_number VARCHAR(20) UNIQUE NULL**, **employment_type ENUM('full_time','part_time','contractor') NULL**, **employment_percentage SMALLINT DEFAULT 100 CHECK (employment_percentage BETWEEN 0 AND 100)**, **department VARCHAR(100) NULL**, **daily_hours_override SMALLINT NULL**, created_at, updated_at)
  > `role` enum values: `admin`, `user`. No `manager` role — lead manager assignment is via `projects.manager_user_id` (GAP-27).
  > `first_name + last_name` replaces the single `full_name` column. Use `CONCAT(first_name, ' ', last_name)` for display (GAP-25).
- [x] 002_create_clients (id, **client_number VARCHAR(20) UNIQUE NULL**, name, contact_info, is_active, created_at, updated_at)
  > `client_number` is an optional admin-assigned human-readable identifier (e.g. `#001`). Not auto-populated from `id` (GAP-20).
- [x] 003_create_projects (id, client_id FK, name, **manager_user_id INT NULL REFERENCES users(id)**, **start_date DATE NULL**, **end_date DATE NULL**, **description TEXT NULL**, is_active, created_at, updated_at)
- [x] 004_create_tasks (id, project_id FK, name, status **ENUM('open','closed') NOT NULL DEFAULT 'open'**, **start_date DATE NULL**, **end_date DATE NULL**, **description TEXT NULL**, created_at, updated_at)
- [x] 005_create_user_task_assignments (id, user_id FK, task_id FK, is_active, unique constraint on active user+task, created_at, updated_at)

### 3. Reporting migrations

- [x] 006_create_time_entries (id, user_id FK, date, start_time, end_time, duration_minutes, client_id FK, project_id FK, task_id FK, location **ENUM('office','home','client') NOT NULL**, description, status **ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft'**, version INT DEFAULT 0, **last_modified_by INT FK NULL** (references users.id), **last_modified_by_role VARCHAR(10) NULL**, **rejection_reason TEXT NULL**, **approved_by INT NULL REFERENCES users(id)**, **approved_at TIMESTAMPTZ NULL**, **deleted_at TIMESTAMPTZ NULL**, created_at, updated_at)
  > `deleted_at` enables soft-delete: all queries must filter `WHERE deleted_at IS NULL` (GAP-42).
  > `rejection_reason` stores per-entry rejection text set by admin (GAP-04).
  > `approved_by` + `approved_at` record who approved the entry and when (GAP-05).
- [x] 007_create_absence_entries (id, user_id FK, type **ENUM('sick','vacation_full','vacation_half','reserve') NOT NULL**, start_date, end_date, is_partial bool, notes, status **ENUM('draft','submitted','approved') NOT NULL DEFAULT 'draft'**, **version INT DEFAULT 0**, created_at, updated_at)
  > `type` enum — `vacation_half` = half-day vacation (partial absence + work hours allowed that day) (GAP-36).
- [x] 008_create_attachments (id, absence_id FK, file_name, file_path, mime_type, size_bytes, uploaded_by FK, created_at)

### 4. Lifecycle migrations

- [x] 009_create_weekly_submissions (id, user_id FK, week_start_date, status **ENUM('draft','submitted','approved','rejected','missing') NOT NULL DEFAULT 'draft'**, submitted_at, **actioned_by INT NULL REFERENCES users(id)**, **actioned_at TIMESTAMPTZ NULL**, rejection_reason)
  > Column renamed from `reviewed_by`/`reviewed_at` → `actioned_by`/`actioned_at` to cover both approve and reject without ambiguity (GAP-32). Comment in migration: `-- populated on both APPROVE and REJECT; check status column to determine which`.
- [x] 010_create_month_locks (id, year int, month int, locked_by FK, locked_at, unlocked_by FK NULL, unlocked_at TIMESTAMPTZ NULL, **unlock_reason TEXT NULL**, is_locked bool, **CONSTRAINT uq_month_locks_year_month UNIQUE (year, month)**)
  > UNIQUE constraint prevents race-condition double-lock of the same month (GAP-49).

### 5. System migrations

- [x] 011_create_audit_logs (id, actor_user_id FK, target_entity_type **ENUM('USER','CLIENT','PROJECT','TASK','ASSIGNMENT','TIME_ENTRY','ABSENCE','WEEKLY_SUBMISSION','MONTH_LOCK','SETTING','HOLIDAY','TIMER') NOT NULL** (12 types), target_entity_id, action **ENUM('LOGIN','CREATE','UPDATE','DELETE','SUBMIT','APPROVE','REJECT','LOCK','UNLOCK','ADMIN_EDIT','TIMER_AUTO_STOPPED','WEEK_RESUBMITTED','EXPORT','PASSWORD_RESET','DEACTIVATE','ENTRY_CORRECTED') NOT NULL** (16 types), old_value jsonb, new_value jsonb, reason TEXT NULL, timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), ip_address VARCHAR(45))
  > `ENTRY_CORRECTED` = user edits their own previously-rejected entry. `ADMIN_EDIT` = admin edits a user's entry (GAP-15, GAP-36).
- [x] 012_create_system_settings (id, key unique, value jsonb, updated_by FK, updated_at)
- [x] 013_create_holiday_calendar (id, date unique, name, type **ENUM('national','company','partial_day') NOT NULL**, created_by FK, created_at)
  > `partial_day` holidays reduce daily quota by 50% (DAILY_STANDARD_HOURS / 2). `national` and `company` reduce by 100% (GAP-38).
- [x] 014_create_active_timers (id, user_id FK unique, start_time, **warning_sent_at TIMESTAMPTZ NULL**, created_at)
  > `warning_sent_at` enables deduplication of the 10h TIMER_LONG_RUNNING notification: set when notification fires, checked by cron (`WHERE warning_sent_at IS NULL`) (GAP-37).
- [x] 015_create_permission_flags (id, user_id FK, flag_name **VARCHAR(50) NOT NULL** — currently only `'canAssignProjectTasks'`, scoped_project_ids jsonb, granted_by FK, created_at)
- [x] 016_create_refresh_tokens (id, user_id FK, token_hash CHAR(64) UNIQUE, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ NULL, ip_address VARCHAR(45), user_agent TEXT, created_at) — stores hashed refresh tokens for rotation and invalidation. **This migration is mandatory** — required for JWT rotation and session invalidation (GAP-48).
- [x] 017_create_notifications (id, user_id FK, type ENUM('WEEK_REJECTED','MISSING_REPORT','ADMIN_EDIT','LOCKED_MONTH','TIMER_LONG_RUNNING','TIMER_AUTO_STOPPED','QUOTA_WARNING'), title TEXT, body TEXT, related_entity_type VARCHAR(50) NULL, related_entity_id INT NULL, is_read BOOL DEFAULT false, created_at)
  > `TIMER_AUTO_STOPPED` added as a distinct type from `TIMER_LONG_RUNNING` (GAP-52).

### 6. Indexes

- [x] Index on time_entries (user_id, date) for daily queries
- [x] Index on time_entries (user_id, date, start_time, end_time) for overlap detection
- [x] Index on weekly_submissions (user_id, week_start_date) for submission lookups
- [x] Index on audit_logs (target_entity_type, target_entity_id, timestamp) for filtering
- [x] Index on absence_entries (user_id, start_date, end_date) for quota calculation

### 6b. Secondary Indexes (019_add_secondary_indexes)

**High Priority**
- [x] `idx_time_entries_user_status_date` — approval workflow filter (user_id, status, date) WHERE deleted_at IS NULL
- [x] `idx_weekly_submissions_user_status` — admin dashboard rejected/missing filter (user_id, status)
- [x] `idx_absence_entries_user_status` — quota calculation approved-only filter (user_id, status)
- [x] `idx_time_entries_approved_by` — audit trail: what admin X approved (approved_by, approved_at) WHERE deleted_at IS NULL
- [x] `idx_audit_logs_actor_timestamp` — recent actions by a specific user (actor_user_id, timestamp DESC)

**Medium Priority**
- [x] `idx_time_entries_project_task` — billable hours per project/task (project_id, task_id) WHERE deleted_at IS NULL
- [x] `idx_user_task_assignments_user` — all tasks assigned to a user (user_id)
- [x] `idx_user_task_assignments_task` — all users assigned to a task (task_id)
- [x] `idx_refresh_tokens_user_expires` — expired token cleanup cron (user_id, expires_at)
- [x] `idx_notifications_user_unread` — unread notification count per user (user_id, is_read)

**Low Priority**
- [x] `idx_permission_flags_user` — all permissions for a user (user_id)
- [x] `idx_permission_flags_flag_name` — which users have a given flag (flag_name)
- [x] `idx_absence_entries_type` — vacation vs sick day statistics (type)

### 7. Seed data

- [x] Create default admin user (email: admin@system.com, password: must change on first login)
- [x] Create test data script for development: 5 users, 3 clients, 5 projects, 10 tasks, sample assignments

## API Endpoints

None — database layer only

## Database Tables

All 17 tables (15 original + refresh_tokens + notifications)

## Screens / UI

None

## Files to Create/Modify

- `server/src/database/connection.js`
- `server/src/database/migrations/001–017`
- `server/src/database/seeds/`

## Acceptance Criteria

- [x] All migrations run without errors on fresh database
- [x] All migrations can be rolled back cleanly
- [x] Seed data creates valid test dataset
- [x] Foreign key constraints enforced
- [x] Unique constraints enforced (e.g., no duplicate active user+task assignment)
- [x] `users.failed_login_attempts` defaults to 0 and `lockout_until` defaults to NULL
- [x] `users.role` ENUM is `('admin','user')` — no `manager` role
- [x] `users.first_name` + `users.last_name` are separate columns (not a single `full_name`)
- [x] `users.employment_percentage` is between 0 and 100 (CHECK constraint)
- [x] `clients.client_number` is UNIQUE (when provided)
- [x] `projects` table includes `manager_user_id`, `start_date`, `end_date`, `description`
- [x] `tasks` table includes `start_date`, `end_date`, `description`
- [x] `time_entries.deleted_at` is NULL for active records; soft-delete sets it to NOW()
- [x] `time_entries.rejection_reason` stores per-entry admin rejection text
- [x] `time_entries.approved_by` + `approved_at` populated on approval
- [x] `absence_entries.type` ENUM is `('sick','vacation_full','vacation_half','reserve')`
- [x] `weekly_submissions.actioned_by` + `actioned_at` replace `reviewed_by` + `reviewed_at`
- [x] `weekly_submissions.status` ENUM is `('draft','submitted','approved','rejected','missing')`
- [x] `month_locks` has UNIQUE constraint on `(year, month)`
- [x] `month_locks.unlock_reason` stores text when unlock occurs
- [x] `active_timers.warning_sent_at` defaults to NULL
- [x] `holiday_calendar.type` ENUM is `('national','company','partial_day')`
- [x] `audit_logs.action` ENUM includes all 16 action types (LOGIN through ENTRY_CORRECTED)
- [x] `audit_logs.target_entity_type` ENUM includes all 12 entity types
- [x] `notifications.type` ENUM includes `TIMER_AUTO_STOPPED` (distinct from `TIMER_LONG_RUNNING`)
- [x] `refresh_tokens.token_hash` has UNIQUE constraint
- [x] `absence_entries.version` defaults to 0 and increments on each update

