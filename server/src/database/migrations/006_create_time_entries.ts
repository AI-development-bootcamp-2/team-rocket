// @ts-nocheck
/**
 * Migration: 006_create_time_entries
 * - location ENUM: 'office', 'home', 'client'
 * - status ENUM: 'draft', 'submitted', 'approved', 'rejected'
 * - deleted_at enables soft-delete (GAP-42) — all queries must filter WHERE deleted_at IS NULL
 * - rejection_reason: per-entry admin rejection text (GAP-04)
 * - approved_by + approved_at: populated on approval (GAP-05)
 * - last_modified_by + last_modified_by_role: audit trail for edits
 */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE time_entry_location AS ENUM ('office', 'home', 'client')`);
  await knex.raw(`CREATE TYPE time_entry_status AS ENUM ('draft', 'submitted', 'approved', 'rejected')`);

  await knex.schema.createTable('time_entries', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.date('date').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.integer('duration_minutes').notNullable();
    table.integer('client_id').notNullable().references('id').inTable('clients').onDelete('RESTRICT');
    table.integer('project_id').notNullable().references('id').inTable('projects').onDelete('RESTRICT');
    table.integer('task_id').notNullable().references('id').inTable('tasks').onDelete('RESTRICT');
    table.specificType('location', 'time_entry_location').notNullable();
    table.text('description').nullable();
    table.specificType('status', 'time_entry_status').notNullable().defaultTo('draft');
    table.integer('version').notNullable().defaultTo(0);
    table.integer('last_modified_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('last_modified_by_role', 10).nullable();
    table.text('rejection_reason').nullable();
    table.integer('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approved_at', { useTz: true }).nullable();
    table.timestamp('deleted_at', { useTz: true }).nullable(); // soft-delete
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('time_entries');
  await knex.raw(`DROP TYPE IF EXISTS time_entry_status`);
  await knex.raw(`DROP TYPE IF EXISTS time_entry_location`);
};

