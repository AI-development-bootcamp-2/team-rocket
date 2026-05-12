// @ts-nocheck
/**
 * Migration: 013_create_holiday_calendar
 * - type ENUM: 'national', 'company', 'partial_day' (GAP-38)
 *   partial_day reduces daily quota by 50% (DAILY_STANDARD_HOURS / 2)
 *   national and company reduce by 100%
 * - date is unique — one holiday entry per date
 */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE holiday_type AS ENUM ('national', 'company', 'partial_day')`);

  await knex.schema.createTable('holiday_calendar', (table) => {
    table.increments('id').primary();
    table.date('date').notNullable().unique();
    table.string('name', 255).notNullable();
    table.specificType('type', 'holiday_type').notNullable();
    table.integer('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('holiday_calendar');
  await knex.raw(`DROP TYPE IF EXISTS holiday_type`);
};

