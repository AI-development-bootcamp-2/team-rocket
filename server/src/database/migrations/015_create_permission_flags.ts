// @ts-nocheck
/**
 * Migration: 015_create_permission_flags
 * - flag_name VARCHAR(50) — currently only 'canAssignProjectTasks'
 * - scoped_project_ids jsonb — array of project IDs the flag applies to
 */
exports.up = async function (knex) {
  await knex.schema.createTable('permission_flags', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('flag_name', 50).notNullable();
    table.jsonb('scoped_project_ids').nullable();
    table.integer('granted_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('permission_flags');
};

