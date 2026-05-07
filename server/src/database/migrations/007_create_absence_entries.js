/**
 * Migration: 007_create_absence_entries
 * - type ENUM: 'sick', 'vacation_full', 'vacation_half', 'reserve' (GAP-36)
 *   vacation_half = half-day vacation (partial absence + work hours allowed that day)
 * - status ENUM: 'draft', 'submitted', 'approved'
 * - version defaults to 0, increments on each update
 */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE absence_type AS ENUM ('sick', 'vacation_full', 'vacation_half', 'reserve')`);
  await knex.raw(`CREATE TYPE absence_status AS ENUM ('draft', 'submitted', 'approved')`);

  await knex.schema.createTable('absence_entries', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.specificType('type', 'absence_type').notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.boolean('is_partial').notNullable().defaultTo(false);
    table.text('notes').nullable();
    table.specificType('status', 'absence_status').notNullable().defaultTo('draft');
    table.integer('version').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('absence_entries');
  await knex.raw(`DROP TYPE IF EXISTS absence_status`);
  await knex.raw(`DROP TYPE IF EXISTS absence_type`);
};
