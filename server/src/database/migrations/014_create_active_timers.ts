// @ts-nocheck
/**
 * Migration: 014_create_active_timers
 * - user_id is UNIQUE — one active timer per user at a time
 * - warning_sent_at defaults to NULL (GAP-37)
 *   set when TIMER_LONG_RUNNING notification fires, checked by cron WHERE warning_sent_at IS NULL
 */
exports.up = async function (knex) {
  await knex.schema.createTable('active_timers', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('start_time', { useTz: true }).notNullable();
    table.timestamp('warning_sent_at', { useTz: true }).nullable().defaultTo(null);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('active_timers');
};

