/**
 * Migration: 018_create_indexes
 * Performance indexes per F02 spec.
 */
exports.up = async function (knex) {
  // Daily queries: fetch a user's entries for a specific date
  await knex.raw(`
    CREATE INDEX idx_time_entries_user_date
    ON time_entries (user_id, date)
    WHERE deleted_at IS NULL
  `);

  // Overlap detection: check for conflicting time ranges on the same day
  await knex.raw(`
    CREATE INDEX idx_time_entries_overlap
    ON time_entries (user_id, date, start_time, end_time)
    WHERE deleted_at IS NULL
  `);

  // Weekly submission lookups: find a user's submission for a specific week
  await knex.raw(`
    CREATE INDEX idx_weekly_submissions_user_week
    ON weekly_submissions (user_id, week_start_date)
  `);

  // Audit log filtering: query logs by entity type + id + time range
  await knex.raw(`
    CREATE INDEX idx_audit_logs_entity_timestamp
    ON audit_logs (target_entity_type, target_entity_id, timestamp)
  `);

  // Quota calculation: find absence entries overlapping a date range for a user
  await knex.raw(`
    CREATE INDEX idx_absence_entries_user_dates
    ON absence_entries (user_id, start_date, end_date)
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_absence_entries_user_dates`);
  await knex.raw(`DROP INDEX IF EXISTS idx_audit_logs_entity_timestamp`);
  await knex.raw(`DROP INDEX IF EXISTS idx_weekly_submissions_user_week`);
  await knex.raw(`DROP INDEX IF EXISTS idx_time_entries_overlap`);
  await knex.raw(`DROP INDEX IF EXISTS idx_time_entries_user_date`);
};
