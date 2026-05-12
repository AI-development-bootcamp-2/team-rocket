/**
 * Migration: 021_timer_on_time_entries
 *
 * Removes the active_timers table and moves timer state into time_entries.
 * A running timer is a time_entries row where end_time IS NULL and date = today.
 * An open row from a previous date is treated as a missing/incomplete report, not
 * a running timer — the user gets a fresh timer each day.
 *
 * Changes to time_entries:
 *   - end_time, duration_minutes, client_id, project_id, task_id, location
 *     become nullable so a partial row can be inserted on timer start and
 *     completed (filled in) on timer stop.
 */
exports.up = async function (knex) {
  // Make entry fields nullable for the partial (in-flight) timer row
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN end_time DROP NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN duration_minutes DROP NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN client_id DROP NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN project_id DROP NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN task_id DROP NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN location DROP NOT NULL');

  // One running timer per user per day — scoped to today at query time (app-layer check)
  // A partial index on (user_id, date) WHERE end_time IS NULL prevents two open rows on the same date.
  await knex.raw(`
    CREATE UNIQUE INDEX unique_running_timer_per_user_per_day
      ON time_entries (user_id, date)
      WHERE end_time IS NULL AND deleted_at IS NULL
  `);

  // Remove the old standalone timer table
  await knex.schema.dropTableIfExists('active_timers');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS unique_running_timer_per_user_per_day');

  // Restore NOT NULL constraints (existing NULL rows must be cleaned up first)
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN end_time SET NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN duration_minutes SET NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN client_id SET NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN project_id SET NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN task_id SET NOT NULL');
  await knex.raw('ALTER TABLE time_entries ALTER COLUMN location SET NOT NULL');

  await knex.schema.createTable('active_timers', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('start_time', { useTz: true }).notNullable();
    table.timestamp('warning_sent_at', { useTz: true }).nullable().defaultTo(null);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};
