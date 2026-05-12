// @ts-nocheck
/**
 * Migration: 019_add_secondary_indexes
 * Additional performance indexes beyond the 5 spec-required ones.
 * Grouped by priority.
 */
exports.up = async function (knex) {
  // ── High Priority ──────────────────────────────────────────────────────────

  // Approval workflow: filter by user + status + date range
  await knex.raw(`
    CREATE INDEX idx_time_entries_user_status_date
    ON time_entries (user_id, status, date)
    WHERE deleted_at IS NULL
  `);

  // Admin dashboard: filter weekly submissions by status (rejected, missing)
  await knex.raw(`
    CREATE INDEX idx_weekly_submissions_user_status
    ON weekly_submissions (user_id, status)
  `);

  // Quota calculation: filter absences by approved status only
  await knex.raw(`
    CREATE INDEX idx_absence_entries_user_status
    ON absence_entries (user_id, status)
  `);

  // Audit trail: what did admin X approve and when?
  await knex.raw(`
    CREATE INDEX idx_time_entries_approved_by
    ON time_entries (approved_by, approved_at)
    WHERE deleted_at IS NULL
  `);

  // Audit trail: recent actions by a specific user
  await knex.raw(`
    CREATE INDEX idx_audit_logs_actor_timestamp
    ON audit_logs (actor_user_id, timestamp DESC)
  `);

  // ── Medium Priority ────────────────────────────────────────────────────────

  // Billable hours per project/task reporting
  await knex.raw(`
    CREATE INDEX idx_time_entries_project_task
    ON time_entries (project_id, task_id)
    WHERE deleted_at IS NULL
  `);

  // Find all tasks assigned to a user
  await knex.raw(`
    CREATE INDEX idx_user_task_assignments_user
    ON user_task_assignments (user_id)
  `);

  // Find all users assigned to a task
  await knex.raw(`
    CREATE INDEX idx_user_task_assignments_task
    ON user_task_assignments (task_id)
  `);

  // Expired token cleanup cron
  await knex.raw(`
    CREATE INDEX idx_refresh_tokens_user_expires
    ON refresh_tokens (user_id, expires_at)
  `);

  // Unread notification count per user
  await knex.raw(`
    CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, is_read)
  `);

  // ── Low Priority ───────────────────────────────────────────────────────────

  // Find all permissions for a user
  await knex.raw(`
    CREATE INDEX idx_permission_flags_user
    ON permission_flags (user_id)
  `);

  // "Which users can assign project tasks?"
  await knex.raw(`
    CREATE INDEX idx_permission_flags_flag_name
    ON permission_flags (flag_name)
  `);

  // Statistics: vacation vs sick day counts
  await knex.raw(`
    CREATE INDEX idx_absence_entries_type
    ON absence_entries (type)
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_absence_entries_type`);
  await knex.raw(`DROP INDEX IF EXISTS idx_permission_flags_flag_name`);
  await knex.raw(`DROP INDEX IF EXISTS idx_permission_flags_user`);
  await knex.raw(`DROP INDEX IF EXISTS idx_notifications_user_unread`);
  await knex.raw(`DROP INDEX IF EXISTS idx_refresh_tokens_user_expires`);
  await knex.raw(`DROP INDEX IF EXISTS idx_user_task_assignments_task`);
  await knex.raw(`DROP INDEX IF EXISTS idx_user_task_assignments_user`);
  await knex.raw(`DROP INDEX IF EXISTS idx_time_entries_project_task`);
  await knex.raw(`DROP INDEX IF EXISTS idx_audit_logs_actor_timestamp`);
  await knex.raw(`DROP INDEX IF EXISTS idx_time_entries_approved_by`);
  await knex.raw(`DROP INDEX IF EXISTS idx_absence_entries_user_status`);
  await knex.raw(`DROP INDEX IF EXISTS idx_weekly_submissions_user_status`);
  await knex.raw(`DROP INDEX IF EXISTS idx_time_entries_user_status_date`);
};

