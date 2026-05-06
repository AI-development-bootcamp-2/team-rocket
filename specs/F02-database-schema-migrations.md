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

- [ ] Install Knex.js or similar migration tool
- [ ] Configure connection to Docker PostgreSQL
- [ ] Create migration runner script
- [ ] Add migrate command to package.json

### 2. Core entity migrations

- [ ] 001_create_users (id, email, password_hash, full_name, role, is_active, must_change_password, **failed_login_attempts INT DEFAULT 0**, **lockout_until TIMESTAMPTZ NULL**, **sort_prefs JSONB NULL**, created_at, updated_at)
- [ ] 002_create_clients (id, name, contact_info, is_active, created_at, updated_at)
- [ ] 003_create_projects (id, client_id FK, name, is_active, created_at, updated_at)
- [ ] 004_create_tasks (id, project_id FK, name, status enum open/closed, created_at, updated_at)
- [ ] 005_create_user_task_assignments (id, user_id FK, task_id FK, is_active, unique constraint on active user+task, created_at, updated_at)

### 3. Reporting migrations

- [ ] 006_create_time_entries (id, user_id FK, date, start_time, end_time, duration_minutes, client_id FK, project_id FK, task_id FK, location enum, description, status enum, version INT DEFAULT 0, **last_modified_by INT FK NULL** (references users.id), **last_modified_by_role VARCHAR(10) NULL**, created_at, updated_at)
- [ ] 007_create_absence_entries (id, user_id FK, type enum, start_date, end_date, is_partial bool, notes, status enum, **version INT DEFAULT 0**, created_at, updated_at)
- [ ] 008_create_attachments (id, absence_id FK, file_name, file_path, mime_type, size_bytes, uploaded_by FK, created_at)

### 4. Lifecycle migrations

- [ ] 009_create_weekly_submissions (id, user_id FK, week_start_date, status enum, submitted_at, reviewed_by FK, reviewed_at, rejection_reason)
- [ ] 010_create_month_locks (id, year int, month int, locked_by FK, locked_at, unlocked_by FK NULL, unlocked_at TIMESTAMPTZ NULL, **unlock_reason TEXT NULL**, is_locked bool)

### 5. System migrations

- [ ] 011_create_audit_logs (id, actor_user_id FK, target_entity_type enum, target_entity_id, action enum, old_value jsonb, new_value jsonb, reason, timestamp, ip_address)
- [ ] 012_create_system_settings (id, key unique, value jsonb, updated_by FK, updated_at)
- [ ] 013_create_holiday_calendar (id, date unique, name, type enum, created_by FK, created_at)
- [ ] 014_create_active_timers (id, user_id FK unique, start_time, created_at)
- [ ] 015_create_permission_flags (id, user_id FK, flag_name, scoped_project_ids jsonb, granted_by FK, created_at)
- [ ] 016_create_refresh_tokens (id, user_id FK, token_hash CHAR(64) UNIQUE, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ NULL, ip_address VARCHAR(45), user_agent TEXT, created_at) — stores hashed refresh tokens for rotation and invalidation
- [ ] 017_create_notifications (id, user_id FK, type ENUM('WEEK_REJECTED','MISSING_REPORT','ADMIN_EDIT','LOCKED_MONTH','TIMER_LONG_RUNNING','QUOTA_WARNING'), title TEXT, body TEXT, related_entity_type VARCHAR(50) NULL, related_entity_id INT NULL, is_read BOOL DEFAULT false, created_at)

### 6. Indexes

- [ ] Index on time_entries (user_id, date) for daily queries
- [ ] Index on time_entries (user_id, date, start_time, end_time) for overlap detection
- [ ] Index on weekly_submissions (user_id, week_start_date) for submission lookups
- [ ] Index on audit_logs (target_entity_type, target_entity_id, timestamp) for filtering
- [ ] Index on absence_entries (user_id, start_date, end_date) for quota calculation

### 7. Seed data

- [ ] Create default admin user (email: admin@system.com, password: must change on first login)
- [ ] Create test data script for development: 5 users, 3 clients, 5 projects, 10 tasks, sample assignments

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

- [ ] All migrations run without errors on fresh database
- [ ] All migrations can be rolled back cleanly
- [ ] Seed data creates valid test dataset
- [ ] Foreign key constraints enforced
- [ ] Unique constraints enforced (e.g., no duplicate active user+task assignment)
- [ ] `users.failed_login_attempts` defaults to 0 and `lockout_until` defaults to NULL
- [ ] `refresh_tokens.token_hash` has UNIQUE constraint
- [ ] `month_locks.unlock_reason` stores text when unlock occurs
- [ ] `absence_entries.version` defaults to 0 and increments on each update

